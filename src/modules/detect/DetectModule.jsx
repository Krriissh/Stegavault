import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertTriangle, CheckCircle, XCircle, Info, BarChart2, Waves, Activity } from 'lucide-react';

import FileDropzone from '../../components/FileDropzone.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';
import MetadataCard, { buildAnalysisMetadata } from '../../components/MetadataCard.jsx';

import { analyzeImage, renderHeatmapCanvas } from '../../core/analysis/steganalysis.js';
import { loadImageFile } from '../../core/stego/stegoEngine.js';
import { saveHistory } from '../../storage/indexedDB.js';

const STATUS = { idle: 'idle', processing: 'processing', done: 'done', error: 'error' };

function RiskGauge({ probability }) {
  const angle = -90 + (probability / 100) * 180;
  const color = probability < 30 ? '#00ff88' : probability < 65 ? '#f59e0b' : '#ff4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 70" className="w-40">
        {/* Background arc */}
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#1a2744" strokeWidth="8" strokeLinecap="round" />
        {/* Green zone */}
        <path d="M 10 60 A 50 50 0 0 1 43 21" fill="none" stroke="#00ff8830" strokeWidth="8" strokeLinecap="round" />
        {/* Yellow zone */}
        <path d="M 43 21 A 50 50 0 0 1 77 21" fill="none" stroke="#f59e0b30" strokeWidth="8" strokeLinecap="round" />
        {/* Red zone */}
        <path d="M 77 21 A 50 50 0 0 1 110 60" fill="none" stroke="#ff444430" strokeWidth="8" strokeLinecap="round" />
        {/* Needle */}
        <g transform={`rotate(${angle}, 60, 60)`}>
          <line x1="60" y1="60" x2="60" y2="16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="60" cy="60" r="4" fill={color} />
        </g>
        {/* Labels */}
        <text x="8"  y="75" fill="#00ff88" fontSize="7" fontFamily="Orbitron">LOW</text>
        <text x="48" y="75" fill="#f59e0b" fontSize="7" fontFamily="Orbitron">MED</text>
        <text x="90" y="75" fill="#ff4444" fontSize="7" fontFamily="Orbitron">HIGH</text>
      </svg>
      <div className="text-center">
        <p style={{ color }} className="text-3xl font-display font-bold">{probability}%</p>
        <p className="text-[10px] text-cyber-muted font-mono">Stego Probability</p>
      </div>
    </div>
  );
}

function TestResultBar({ label, score, description, icon: Icon, color }) {
  const colorClass = {
    green:  'bg-cyber-green',
    blue:   'bg-cyber-blue',
    purple: 'bg-cyber-purple',
    yellow: 'bg-cyber-yellow',
  }[color] ?? 'bg-cyber-green';

  const textClass = {
    green:  'text-cyber-green',
    blue:   'text-cyber-blue',
    purple: 'text-cyber-purple',
    yellow: 'text-cyber-yellow',
  }[color] ?? 'text-cyber-green';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${textClass}`} />
          <span className="text-xs font-display text-cyber-text">{label}</span>
        </div>
        <span className={`text-xs font-bold font-mono ${textClass}`}>{score}%</span>
      </div>
      <div className="h-1.5 bg-black/40 rounded-full border border-cyber-border overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <p className="text-[10px] text-cyber-muted font-mono">{description}</p>
    </div>
  );
}

export default function DetectModule() {
  const [imageFile, setImageFile]       = useState(null);
  const [status, setStatus]             = useState(STATUS.idle);
  const [progress, setProgress]         = useState(0);
  const [progressMsg, setProgressMsg]   = useState('');
  const [report, setReport]             = useState(null);
  const [errorMsg, setErrorMsg]         = useState('');
  const [showHeatmap, setShowHeatmap]   = useState(false);
  const [imgObjectUrl, setImgObjectUrl] = useState(null);

  const heatmapRef   = useRef(null);
  const originalRef  = useRef(null);

  const handleAnalyze = async () => {
    setErrorMsg('');
    if (!imageFile) return setErrorMsg('Please select an image to analyze.');

    setStatus(STATUS.processing);
    setProgress(0);
    setReport(null);

    try {
      setProgressMsg('Loading image…');
      setProgress(10);
      const { imageData, width, height, objectUrl } = await loadImageFile(imageFile);
      setImgObjectUrl(objectUrl);

      setProgressMsg('Running Chi-Square LSB test…');
      setProgress(30);
      await new Promise(r => setTimeout(r, 20)); // yield to UI

      setProgressMsg('Running histogram analysis…');
      setProgress(55);
      await new Promise(r => setTimeout(r, 20));

      setProgressMsg('Running Laplacian noise analysis…');
      setProgress(70);
      await new Promise(r => setTimeout(r, 20));

      setProgressMsg('Generating heatmap…');
      setProgress(85);
      const result = analyzeImage(imageData);

      setProgressMsg('Saving to history…');
      setProgress(95);
      await saveHistory({
        filename:  imageFile.name,
        operation: 'analyze',
        status:    'success',
        stegoBlob: null,
        meta: { probability: result.probability, riskLevel: result.riskLevel },
      });

      setProgress(100);
      setReport({ ...result, imageData, width, height });
      setStatus(STATUS.done);
      setProgressMsg('');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus(STATUS.error);
      setProgressMsg('');
    }
  };

  // Render heatmap on canvas when result arrives + heatmap toggled on
  useEffect(() => {
    if (!report || !showHeatmap || !heatmapRef.current) return;
    const { heatmap: { heatmap, blocksX, blocksY }, width, height } = report;
    const canvas = heatmapRef.current;
    canvas.width  = width;
    canvas.height = height;
    renderHeatmapCanvas(canvas, heatmap, blocksX, blocksY, width, height);
  }, [report, showHeatmap]);

  const reset = () => { setStatus(STATUS.idle); setErrorMsg(''); setReport(null); setProgress(0); setImgObjectUrl(null); setShowHeatmap(false); };

  const riskIcon = !report ? null :
    report.riskLevel === 'LOW'    ? <CheckCircle className="w-6 h-6 text-cyber-green" /> :
    report.riskLevel === 'MEDIUM' ? <AlertTriangle className="w-6 h-6 text-cyber-yellow" /> :
                                    <XCircle className="w-6 h-6 text-cyber-red" />;

  const riskBorderClass = !report ? '' :
    report.riskLevel === 'LOW'    ? 'border-cyber-green/30 bg-cyber-green/5' :
    report.riskLevel === 'MEDIUM' ? 'border-cyber-yellow/30 bg-cyber-yellow/5' :
                                    'border-cyber-red/30 bg-cyber-red/5';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyber-purple/10 border border-cyber-purple/30 flex items-center justify-center">
            <Search className="w-5 h-5 text-cyber-purple" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-cyber-purple tracking-wide">Steganalysis</h2>
            <p className="text-xs text-cyber-muted font-mono">Chi-Square · Histogram · LSB Entropy · Majority Voting · Heatmap</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">
            <div className="card-cyber p-4">
              <FileDropzone
                label="Image to Analyze"
                accentColor="purple"
                onFile={f => { setImageFile(f); reset(); }}
                file={imageFile}
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={status === STATUS.processing || !imageFile}
              className="w-full py-3 font-display font-bold text-[13px] tracking-wider uppercase rounded-lg border transition-all flex items-center justify-center gap-2
                bg-cyber-purple/10 border-cyber-purple/30 text-cyber-purple hover:bg-cyber-purple/20 hover:shadow-glow-purple
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              {status === STATUS.processing ? 'Analyzing…' : 'Run Steganalysis'}
            </button>

            {/* Progress */}
            <AnimatePresence>
              {status === STATUS.processing && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-cyber p-4">
                  <ProgressBar value={progress} label="Analyzing…" color="purple" status={progressMsg} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {(status === STATUS.error || errorMsg) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="card-cyber p-4 border border-cyber-red/30 bg-cyber-red/5">
                  <div className="flex gap-3 items-start">
                    <XCircle className="w-5 h-5 text-cyber-red flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-display text-cyber-red font-semibold">Analysis Failed</p>
                      <p className="text-xs font-mono text-cyber-muted">{errorMsg}</p>
                      <button onClick={reset} className="btn-danger text-[10px] px-3 py-1.5">Retry</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Method descriptions */}
            {status === STATUS.idle && (
              <div className="card-cyber p-4 space-y-3">
                <p className="section-label">Analysis Methods</p>
                {[
                  { icon: BarChart2, label: 'Chi-Square LSB', desc: 'Detects value-pair equalization – the primary signature of LSB substitution', color: 'text-cyber-blue' },
                  { icon: Activity,  label: 'Histogram Uniformity', desc: 'Measures how close the aggregate LSB-1 ratio is to exactly 50%', color: 'text-cyber-purple' },
                  { icon: Waves,     label: 'LSB Plane Entropy', desc: 'Detects white-noise transition pattern injected by random bit substitution', color: 'text-cyber-yellow' },
                ].map(m => (
                  <div key={m.label} className="flex gap-3 items-start">
                    <m.icon className={`w-4 h-4 ${m.color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className={`text-xs font-display ${m.color}`}>{m.label}</p>
                      <p className="text-[10px] text-cyber-muted font-mono">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right column: results ── */}
          <div className="space-y-5">
            <AnimatePresence>
              {status === STATUS.done && report && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-5">

                  {/* Risk verdict card */}
                  <div className={`card-cyber p-5 border ${riskBorderClass}`}>
                    <div className="flex items-center gap-4">
                      {riskIcon}
                      <div>
                        <p className={`text-sm font-display font-bold ${
                          report.riskLevel === 'HIGH' ? 'text-cyber-red' :
                          report.riskLevel === 'MEDIUM' ? 'text-cyber-yellow' : 'text-cyber-green'
                        }`}>
                          {report.verdict ?? (report.riskLevel === 'HIGH' ? 'Likely Stego' : 'Clean')}
                        </p>
                        <p className="text-xs font-mono text-cyber-muted">
                          {report.voteScore ?? 0}/3 tests flagged · Risk: {report.riskLevel} · Score: {report.probability}%
                        </p>
                      </div>
                    </div>

                    {/* Gauge */}
                    <div className="mt-4 flex justify-center">
                      <RiskGauge probability={report.probability} />
                    </div>
                  </div>

                  {/* Test breakdown */}
                  <div className="card-cyber p-4 space-y-4">
                    <p className="section-label">Test Breakdown</p>
                    <TestResultBar
                      label={`Chi-Square LSB${report.tests.chiSquare.flag ? ' ⚑' : ''}`}
                      score={report.tests.chiSquare.score}
                      description={`R:${report.tests.chiSquare.channelScores[0]}%  G:${report.tests.chiSquare.channelScores[1]}%  B:${report.tests.chiSquare.channelScores[2]}%  ·  Flag: ${report.tests.chiSquare.flag ? 'YES' : 'no'}`}
                      icon={BarChart2}
                      color={report.tests.chiSquare.flag ? 'red' : 'blue'}
                    />
                    <TestResultBar
                      label={`Histogram Uniformity${report.tests.histogram.flag ? ' ⚑' : ''}`}
                      score={report.tests.histogram.score}
                      description={`LSB ratio: ${report.tests.histogram.lsbRatio}  ·  Flag: ${report.tests.histogram.flag ? 'YES' : 'no'}`}
                      icon={Activity}
                      color={report.tests.histogram.flag ? 'red' : 'purple'}
                    />
                    <TestResultBar
                      label={`LSB Plane Entropy${report.tests.entropy.flag ? ' ⚑' : ''}`}
                      score={report.tests.entropy.score}
                      description={`Transition rate: ${report.tests.entropy.transitionRate}  ·  Flag: ${report.tests.entropy.flag ? 'YES' : 'no'}`}
                      icon={Waves}
                      color={report.tests.entropy.flag ? 'red' : 'yellow'}
                    />
                  </div>

                  {/* Heatmap */}
                  <div className="card-cyber overflow-hidden">
                    <button
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className="w-full flex items-center justify-between px-4 py-3 text-cyber-muted hover:text-cyber-text transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyber-purple" />
                        <span className="text-xs font-display tracking-wider uppercase text-cyber-purple">
                          Spatial Heatmap
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-cyber-muted">
                        {showHeatmap ? 'Hide' : 'Show'} overlay
                      </span>
                    </button>
                    <AnimatePresence>
                      {showHeatmap && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden border-t border-cyber-border"
                        >
                          <div className="relative bg-black">
                            <img
                              ref={originalRef}
                              src={imgObjectUrl}
                              alt="Analyzed"
                              className="w-full max-h-60 object-contain"
                            />
                            <canvas
                              ref={heatmapRef}
                              className="absolute inset-0 w-full h-full"
                              style={{ mixBlendMode: 'multiply' }}
                            />
                          </div>
                          <p className="text-[10px] text-cyber-muted font-mono px-4 py-2">
                            Green = clean · Yellow = medium · Red = suspicious regions
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Stats grid */}
                  <MetadataCard
                    title="Analysis Report"
                    items={buildAnalysisMetadata({
                      probability: report.probability,
                      riskLevel:   report.riskLevel,
                      verdict:     report.verdict,
                      voteScore:   report.voteScore,
                      width:       report.width,
                      height:      report.height,
                      totalPixels: report.meta.totalPixels,
                      tests:       report.tests,
                    })}
                  />

                  <div className="flex gap-2">
                    <button onClick={reset} className="flex-1 btn-secondary text-[11px] py-2">New Analysis</button>
                  </div>

                  <p className="text-[10px] text-cyber-muted/60 font-mono px-1">
                    ⚠ Statistical tests indicate probability, not certainty. Results may vary based on image content.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {status === STATUS.idle && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-cyber p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-cyber-purple/10 border border-cyber-purple/20 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6 text-cyber-purple/50" />
                </div>
                <p className="text-sm text-cyber-muted font-mono">
                  Upload any image to check for hidden data using three statistical detection algorithms
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
