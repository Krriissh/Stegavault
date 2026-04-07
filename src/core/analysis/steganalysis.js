/**
 * StegaVault – Steganalysis Engine  (v2.0)
 *
 * Three independent statistical tests; each casts a boolean vote.
 * Final verdict uses majority voting:
 *
 *   score = (chiSquare_flag ? 1 : 0)
 *         + (histogram_flag ? 1 : 0)
 *         + (entropy_flag   ? 1 : 0)
 *
 *   score >= 2  →  "Likely Stego"
 *   score <  2  →  "Clean"
 *
 * This avoids false positives from single-test artifacts (e.g. naturally
 * high-entropy images like QR codes tripping entropy alone).
 *
 * Reference: Westfeld & Pfitzmann (2000) "Attacks on Steganographic Systems"
 */

// ─── Histogram helper ─────────────────────────────────────────────────────────

function computeHistogram(data, channel) {
  const hist = new Uint32Array(256);
  for (let i = channel; i < data.length; i += 4) hist[data[i]]++;
  return hist;
}

// ─── Test 1: Chi-Square LSB Attack ───────────────────────────────────────────

/**
 * Measures value-pair equalization caused by LSB substitution.
 *
 * In a natural image, histogram[2k] ≠ histogram[2k+1] for most pairs.
 * LSB substitution forces them to equalise (~50/50 split of the combined
 * count).  "Pair Equalization Ratio" close to 1.0 → stego.
 *
 * @param {Uint8ClampedArray} data  RGBA pixel array
 * @returns {{ score: number, channelScores: number[], flag: boolean }}
 */
export function chiSquareAnalysis(data) {
  const scores = [0, 1, 2].map(ch => {
    const hist = computeHistogram(data, ch);
    let totalRatio = 0, activePairs = 0;
    for (let i = 0; i < 128; i++) {
      const v0 = hist[2 * i], v1 = hist[2 * i + 1];
      const sum = v0 + v1;
      if (sum === 0) continue;
      totalRatio += Math.abs(v0 - v1) / sum;
      activePairs++;
    }
    if (activePairs === 0) return 0;
    return 1 - (totalRatio / activePairs);  // near 1 = equal pairs = stego
  });

  const score = scores.reduce((a, b) => a + b, 0) / 3;
  return {
    score,
    channelScores: scores,
    flag: score > 0.72,  // threshold: chi-square equalisation ratio
  };
}

// ─── Test 2: LSB Histogram Uniformity ────────────────────────────────────────

/**
 * Measures how close the aggregate LSB-1 ratio is to exactly 50%.
 *
 * Natural images have a non-uniform LSB distribution (ratios deviate from
 * 0.5 by 0.03–0.15).  LSB steganography drives the ratio toward 0.5.
 *
 * @param {Uint8ClampedArray} data
 * @returns {{ score: number, lsbRatio: number, flag: boolean }}
 */
export function histogramAnalysis(data) {
  let lsbOnes = 0, lsbTotal = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      lsbOnes  += data[i + ch] & 1;
      lsbTotal++;
    }
  }

  const lsbRatio    = lsbOnes / lsbTotal;
  const distFrom50  = Math.abs(lsbRatio - 0.5);
  // Exponential decay: ratio = 0.5 → score = 1; deviation ≥ 0.08 → score < 0.2
  const score       = Math.exp(-distFrom50 * 25);

  return {
    score,
    lsbRatio,
    entropy: 0, // kept for API compatibility; use entropyAnalysis for entropy
    flag: score > 0.70,
  };
}

// ─── Test 3: LSB-Plane Entropy Analysis ──────────────────────────────────────

/**
 * Extracts the LSB plane and measures its Shannon entropy.
 *
 * The LSB plane of a natural image has moderate entropy (~0.7–0.85 bits
 * per "symbol" when symbols = runs of adjacent same-value LSBs).  Heavy
 * LSB embedding makes the plane look like white noise → entropy → 1.0.
 *
 * We use a simple run-length approach: compute the fraction of pixels
 * where the LSB differs from the previous pixel's LSB (transition rate).
 * White noise has a transition rate near 0.5; natural images are lower.
 *
 * @param {Uint8ClampedArray} data
 * @param {number}            width
 * @param {number}            height
 * @returns {{ score: number, transitionRate: number, flag: boolean }}
 */
export function entropyAnalysis(data, width, height) {
  let transitions = 0;
  let comparisons = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const curr = (y * width + x) * 4;
      const prev = (y * width + (x - 1)) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const lsbCurr = data[curr + ch] & 1;
        const lsbPrev = data[prev + ch] & 1;
        if (lsbCurr !== lsbPrev) transitions++;
        comparisons++;
      }
    }
  }

  const transitionRate = comparisons > 0 ? transitions / comparisons : 0;
  // Sigmoid centred at 0.47 (random = 0.5; natural ≈ 0.30–0.44)
  const score = 1 / (1 + Math.exp(-18 * (transitionRate - 0.47)));

  return {
    score,
    transitionRate,
    flag: score > 0.65,
  };
}

// ─── Heatmap generation ───────────────────────────────────────────────────────

/**
 * Generates a block-level chi-square heatmap.
 * Returns Float32Array of shape [blocksY × blocksX] with values in [0, 1].
 */
export function generateHeatmap(data, width, height, blockSize = 16) {
  const blocksX = Math.ceil(width  / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  const heatmap = new Float32Array(blocksX * blocksY);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const blockPixels = [];
      for (let py = by * blockSize; py < Math.min((by + 1) * blockSize, height); py++) {
        for (let px = bx * blockSize; px < Math.min((bx + 1) * blockSize, width); px++) {
          const base = (py * width + px) * 4;
          blockPixels.push(data[base], data[base + 1], data[base + 2], 255);
        }
      }
      if (blockPixels.length === 0) continue;
      const { score } = chiSquareAnalysis(new Uint8ClampedArray(blockPixels));
      heatmap[by * blocksX + bx] = score;
    }
  }

  return { heatmap, blocksX, blocksY };
}

/**
 * Renders the heatmap as a colour overlay on a canvas element.
 * Green (clean) → Yellow (medium) → Red (suspicious).
 */
export function renderHeatmapCanvas(canvas, heatmap, blocksX, blocksY, imgWidth, imgHeight) {
  const ctx    = canvas.getContext('2d');
  const blockW = imgWidth  / blocksX;
  const blockH = imgHeight / blocksY;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const s = heatmap[by * blocksX + bx];
      const r = Math.round(s < 0.5 ? s * 2 * 255 : 255);
      const g = Math.round(s < 0.5 ? 255 : (1 - s) * 2 * 255);
      ctx.fillStyle = `rgba(${r}, ${g}, 0, 0.55)`;
      ctx.fillRect(bx * blockW, by * blockH, blockW, blockH);
    }
  }
}

// ─── Combined analysis ────────────────────────────────────────────────────────

/**
 * Runs all three tests, applies majority voting, and returns a full report.
 *
 * @param {ImageData} imageData
 * @returns {object}
 */
export function analyzeImage(imageData) {
  const { data, width, height } = imageData;

  const chi     = chiSquareAnalysis(data);
  const hist    = histogramAnalysis(data);
  const entropy = entropyAnalysis(data, width, height);
  const heatmap = generateHeatmap(data, width, height);

  // ── Majority voting ──
  const voteScore = (chi.flag ? 1 : 0) + (hist.flag ? 1 : 0) + (entropy.flag ? 1 : 0);
  const verdict   = voteScore >= 2 ? 'Likely Stego' : 'Clean';

  // Weighted probability for the gauge (display only – not used for verdict)
  const combinedScore = 0.45 * chi.score + 0.35 * hist.score + 0.20 * entropy.score;
  const probability   = Math.round(combinedScore * 100);

  let riskLevel, riskColor;
  if (voteScore === 0)      { riskLevel = 'LOW';    riskColor = 'green';  }
  else if (voteScore === 1) { riskLevel = 'MEDIUM'; riskColor = 'yellow'; }
  else                      { riskLevel = 'HIGH';   riskColor = 'red';    }

  return {
    probability,
    voteScore,
    verdict,
    riskLevel,
    riskColor,
    tests: {
      chiSquare: {
        score:        Math.round(chi.score * 100),
        channelScores: chi.channelScores.map(s => Math.round(s * 100)),
        flag:         chi.flag,
        label:        'Chi-Square LSB Test',
        description:  'Detects value-pair equalization caused by LSB substitution',
      },
      histogram: {
        score:    Math.round(hist.score * 100),
        lsbRatio: (hist.lsbRatio * 100).toFixed(2) + '%',
        flag:     hist.flag,
        label:    'Histogram / LSB Uniformity',
        description: 'Measures how close aggregate LSB ratio is to 50%',
      },
      entropy: {
        score:          Math.round(entropy.score * 100),
        transitionRate: (entropy.transitionRate * 100).toFixed(2) + '%',
        flag:           entropy.flag,
        label:          'LSB Plane Entropy',
        description:    'Detects white-noise pattern from random bit substitution',
      },
    },
    heatmap,
    meta: { width, height, totalPixels: width * height },
  };
}
