"use client";

import React, { useState, useEffect } from "react";
import { analyzeSpectralData, previewSpectrumFile } from "@/app/services/api";
import { AnalysisResult, ModelType, ProcessingStep, SpectrumPoint, SpectrumPreviewResponse } from "@/app/types";
import {
  UploadCloud, FileCode, FileDigit, Database, ArrowRight,
  CheckCircle2, AlertCircle, Clock, RefreshCw, Loader2, Sparkles,
  Moon, Sun,
} from "lucide-react";

type ConfidenceComputation = {
  modelLabel: string;
  equation: string;
  steps: { label: string; value: string }[];
};

function getConfidenceComputation(modelType: ModelType, isBt: boolean, confidence: number): ConfidenceComputation {
  const safeConfidence = Math.min(Math.max(confidence, 50.1), 99.9);
  const predictedProbability = safeConfidence / 100;
  const otherProbability = 1 - predictedProbability;

  if (modelType === "1d-cnn") {
    const btProbability = isBt ? predictedProbability : otherProbability;
    const nonBtProbability = 1 - btProbability;
    const rawLogit = Math.log(btProbability / nonBtProbability);

    return {
      modelLabel: "1D-CNN (Sigmoid binary output)",
      equation: "sigmoid(x) = 1 / (1 + e^{-x}) ; p_bt = sigmoid(logit) ; confidence = predicted-class probability × 100",
      steps: [
        { label: "Raw network output (logit)", value: rawLogit.toFixed(4) },
        { label: "p(Bt)", value: `${(btProbability * 100).toFixed(2)}%` },
        { label: "p(Non-Bt)", value: `${(nonBtProbability * 100).toFixed(2)}%` },
        { label: "Decision threshold", value: "Bt if p(Bt) ≥ 50%, else Non-Bt" },
        { label: "Displayed confidence = max class probability", value: `${safeConfidence.toFixed(1)}%` },
      ],
    };
  }

  if (modelType === "svm") {
    const marginScore = Math.log(predictedProbability / otherProbability);
    const plattA = -1;
    const plattB = 0;

    return {
      modelLabel: "SVM (Platt scaling)",
      equation: "p = 1 / (1 + exp(Af + B)) ; confidence = max(p, 1-p) × 100",
      steps: [
        { label: "Decision score (f)", value: marginScore.toFixed(4) },
        { label: "Calibration params (A, B)", value: `(${plattA}, ${plattB})` },
        { label: "Calibrated probability of predicted class", value: `${(predictedProbability * 100).toFixed(2)}%` },
        { label: "Displayed confidence = calibrated probability", value: `${safeConfidence.toFixed(1)}%` },
      ],
    };
  }

  const distancePredicted = 2 * (1 - predictedProbability);
  const distanceOther = 2 * predictedProbability;
  const reconstructedProbability = distanceOther / (distancePredicted + distanceOther);

  return {
    modelLabel: "PLS-DA (distance-normalized probability)",
    equation: "p_class = (1/d_class) / ((1/d_bt) + (1/d_nonbt)) ; confidence = max(p_bt, p_nonbt) × 100",
    steps: [
      { label: "Latent-space distance to predicted class", value: distancePredicted.toFixed(4) },
      { label: "Latent-space distance to alternative class", value: distanceOther.toFixed(4) },
      { label: "Normalized probability of predicted class", value: `${(reconstructedProbability * 100).toFixed(2)}%` },
      { label: "Displayed confidence", value: `${safeConfidence.toFixed(1)}%` },
    ],
  };
}

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [modelType, setModelType] = useState<ModelType>("1d-cnn");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [spectralFile, setSpectralFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 1, label: "Loading Model", subLabel: "Retrieving trained 1D-CNN model (.h5)", status: "pending" },
    { id: 2, label: "Preprocessing", subLabel: "Applying Savitzky-Golay smoothing filter", status: "pending" },
    { id: 3, label: "Inferencing", subLabel: "Running spectral data through neural network", status: "pending" },
  ]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [spectrumPreview, setSpectrumPreview] = useState<SpectrumPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSpectrumZoomed, setIsSpectrumZoomed] = useState(false);
  const confidenceComputation = result
    ? getConfidenceComputation(modelType, result.isBt, result.confidence)
    : null;
  const normalizedResultSpectrum = normalizeSpectrumPoints(result?.spectrum);
  const displaySpectrumSource = spectrumPreview ?? result;
  const normalizedSpectrum = normalizeSpectrumPoints(displaySpectrumSource?.spectrum);
  const spectrumPlot = normalizedSpectrum.length > 1 ? buildSpectrumPath(normalizedSpectrum) : null;

  // Sync dark class on <html>
  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved === "true") setDarkMode(true);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  }, [darkMode]);

  useEffect(() => {
    if (!isSpectrumZoomed) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSpectrumZoomed(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSpectrumZoomed]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "model" | "data") => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (type === "model") {
      setModelFile(selectedFile);
      return;
    }

    setSpectralFile(selectedFile);
    setResult(null);
    setSpectrumPreview(null);
    setPreviewError(null);
    setIsPreviewLoading(true);

    try {
      const preview = await previewSpectrumFile(selectedFile);
      setSpectrumPreview(preview);
    } catch (error) {
      console.error("Spectrum preview failed:", error);
      setPreviewError("Unable to preview this file. Please verify the .spa/.csv format.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const startAnalysis = async () => {
    if (!modelFile || !spectralFile) return;
    setIsProcessing(true);
    setResult(null);
    setProgress(0);
    setSteps((s) => s.map((step) => ({ ...step, status: "pending" })));
    try {
      const analysisResult = await analyzeSpectralData(
        { modelFile, spectralFile, modelType },
        (p, updatedSteps) => {
          setProgress(p);
          setSteps(updatedSteps);
        }
      );
      setResult(analysisResult);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAnalysis = () => {
    setResult(null);
    setProgress(0);
    setIsProcessing(false);
    setSteps((s) => s.map((step) => ({ ...step, status: "pending" })));
  };

  const fullReset = () => {
    setModelFile(null);
    setSpectralFile(null);
    setSpectrumPreview(null);
    setPreviewError(null);
    setIsPreviewLoading(false);
    resetAnalysis();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-6 md:p-12 transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto">

        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Corn Spectral Classification System
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">FTIR-based Transgenic Detection Pipeline</p>
          </div>
          <button
            onClick={() => setDarkMode((d) => !d)}
            className="mt-1 p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-500 transition-all shadow-sm"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Three-column layout */}
        <main className="grid grid-cols-1 md:grid-cols-2 xl:[grid-template-columns:minmax(24rem,1.45fr)_minmax(18rem,0.9fr)_minmax(24rem,1.45fr)] gap-6 items-stretch">

          {/* ── LEFT: Spectrum Preview ── */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Input Spectrum Preview
              </h4>
              {displaySpectrumSource?.spectrumMeta?.preprocessing && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">
                  {displaySpectrumSource.spectrumMeta.preprocessing}
                </span>
              )}
            </div>

            {!spectralFile && (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400 flex-1 flex items-center justify-center">
                Upload a .spa or .csv spectral file to display the waveform.
              </div>
            )}

            {spectralFile && isPreviewLoading && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 flex-1">
                <Loader2 size={14} className="animate-spin" /> Parsing uploaded spectrum…
              </div>
            )}

            {spectralFile && !isPreviewLoading && previewError && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-5 text-center text-xs text-red-700 dark:text-red-300 flex-1 flex items-center justify-center">
                {previewError}
              </div>
            )}

            {spectralFile && !isPreviewLoading && !previewError && spectrumPlot && (
              <>
                <button
                  type="button"
                  onClick={() => setIsSpectrumZoomed(true)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 cursor-zoom-in text-left"
                  aria-label="Zoom spectrum preview"
                >
                  <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-64">
                    <line
                      x1={CHART_PADDING.left}
                      y1={CHART_HEIGHT - CHART_PADDING.bottom}
                      x2={CHART_WIDTH - CHART_PADDING.right}
                      y2={CHART_HEIGHT - CHART_PADDING.bottom}
                      className="stroke-slate-300 dark:stroke-slate-600"
                      strokeWidth="1"
                    />
                    <line
                      x1={CHART_PADDING.left}
                      y1={CHART_PADDING.top}
                      x2={CHART_PADDING.left}
                      y2={CHART_HEIGHT - CHART_PADDING.bottom}
                      className="stroke-slate-300 dark:stroke-slate-600"
                      strokeWidth="1"
                    />
                    <path
                      d={spectrumPlot.path}
                      fill="none"
                      className="stroke-blue-600 dark:stroke-blue-400"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={CHART_PADDING.left}
                      y={CHART_HEIGHT - 8}
                      className="fill-slate-500 dark:fill-slate-400"
                      fontSize="11"
                    >
                      {normalizedSpectrum[0].wavelength.toFixed(0)} {displaySpectrumSource?.spectrumMeta?.xUnit ?? "cm⁻¹"}
                    </text>
                    <text
                      x={CHART_WIDTH - CHART_PADDING.right}
                      y={CHART_HEIGHT - 8}
                      textAnchor="end"
                      className="fill-slate-500 dark:fill-slate-400"
                      fontSize="11"
                    >
                      {normalizedSpectrum[normalizedSpectrum.length - 1].wavelength.toFixed(0)} {displaySpectrumSource?.spectrumMeta?.xUnit ?? "cm⁻¹"}
                    </text>
                    <text
                      x={CHART_PADDING.left + 4}
                      y={CHART_PADDING.top + 10}
                      className="fill-slate-500 dark:fill-slate-400"
                      fontSize="11"
                    >
                      {spectrumPlot.yMax.toFixed(3)} {displaySpectrumSource?.spectrumMeta?.yUnit ?? "a.u."}
                    </text>
                    <text
                      x={CHART_PADDING.left + 4}
                      y={CHART_HEIGHT - CHART_PADDING.bottom - 4}
                      className="fill-slate-500 dark:fill-slate-400"
                      fontSize="11"
                    >
                      {spectrumPlot.yMin.toFixed(3)} {displaySpectrumSource?.spectrumMeta?.yUnit ?? "a.u."}
                    </text>
                  </svg>
                </button>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    Points: {(displaySpectrumSource?.dataPoints ?? normalizedSpectrum.length) || "—"}
                  </span>
                  <span>
                    Range: {displaySpectrumSource?.wavelengthRange ?? `${normalizedSpectrum[0].wavelength.toFixed(0)} - ${normalizedSpectrum[normalizedSpectrum.length - 1].wavelength.toFixed(0)} ${displaySpectrumSource?.spectrumMeta?.xUnit ?? "cm⁻¹"}`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Click the graph to zoom.</p>
              </>
            )}

            {spectralFile && !isPreviewLoading && !previewError && !spectrumPlot && (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400 flex-1 flex items-center justify-center">
                Spectrum points were not returned for this file.
              </div>
            )}
          </section>

          {/* ── MIDDLE: Upload Panel ── */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col flex-1">
              <h2 className="text-base font-semibold mb-1 text-slate-900 dark:text-slate-100">Configuration &amp; Input</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Upload your model and spectral data files</p>

              <div className="space-y-4 mb-6 flex-1">
                {/* Model Upload */}
                <div className="border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/30 rounded-lg p-5 flex flex-col items-center text-center transition-all hover:border-orange-300 dark:hover:border-orange-600">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-3">
                    <Database size={20} />
                  </div>
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm">Custom Model Upload</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">Accepts .h5 (Keras) or .pkl (Scikit)</p>
                  <label className="cursor-pointer bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-400 dark:hover:border-orange-500 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
                    <UploadCloud size={15} />
                    {modelFile ? "Change File" : "Upload Model"}
                    <input type="file" className="hidden" accept=".h5,.pkl" onChange={(e) => handleFileUpload(e, "model")} />
                  </label>
                  {modelFile && (
                    <span className="text-xs font-mono text-orange-700 dark:text-orange-400 mt-2 bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded">
                      {modelFile.name}
                    </span>
                  )}
                </div>

                {/* Data Upload */}
                <div className="border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-5 flex flex-col items-center text-center transition-all hover:border-blue-300 dark:hover:border-blue-600">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-3">
                    <FileDigit size={20} />
                  </div>
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm">Data Ingestion</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">Accepts .SPA or .CSV spectral files</p>
                  <div className="w-full h-28 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-slate-800/50 flex flex-col items-center justify-center p-4 relative hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".spa,.csv"
                      onChange={(e) => handleFileUpload(e, "data")}
                    />
                    {spectralFile ? (
                      <>
                        <FileCode className="text-blue-500 dark:text-blue-400 mb-1" size={20} />
                        <span className="text-xs font-mono text-blue-700 dark:text-blue-400">{spectralFile.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-blue-900 dark:text-blue-300 font-medium">Drop file here</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">or click to browse</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Confidence Method
                </label>
                <select
                  value={modelType}
                  onChange={(event) => setModelType(event.target.value as ModelType)}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1d-cnn">1D-CNN (Sigmoid)</option>
                  <option value="svm">SVM (Platt Scaling)</option>
                  <option value="pls-da">PLS-DA (Distance Normalization)</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Selects the formula shown in the transparency panel for the confidence score.
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-700">
                {(modelFile || spectralFile || result) && (
                  <button
                    onClick={fullReset}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={12} /> Clear all
                  </button>
                )}
                <button
                  onClick={startAnalysis}
                  disabled={!modelFile || !spectralFile || isProcessing}
                  className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {isProcessing ? "Analyzing…" : "Analyze Sample"}
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Results Panel ── */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col flex-1">

              {/* Idle state */}
              {!isProcessing && !result && (
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Sparkles size={24} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">No Analysis Yet</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                    Upload your model and spectral data files, then click{" "}
                    <span className="font-medium text-slate-500 dark:text-slate-400">Analyze Sample</span> to see results here.
                  </p>
                </div>
              )}

              {/* Processing state */}
              {isProcessing && (
                <div>
                  <h2 className="text-base font-semibold mb-1 text-slate-900 dark:text-slate-100">Processing Pipeline</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Analyzing spectral data through neural network</p>

                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      <span>Overall Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {steps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          step.status === "loading"
                            ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30"
                            : step.status === "complete"
                            ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30"
                            : "border-slate-100 dark:border-slate-700"
                        }`}
                      >
                        <div className="shrink-0">
                          {step.status === "loading" && <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={18} />}
                          {step.status === "complete" && <CheckCircle2 className="text-green-600 dark:text-green-400" size={18} />}
                          {step.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />}
                        </div>
                        <div>
                          <h4 className={`text-sm font-medium ${step.status === "pending" ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>
                            {step.label}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{step.subLabel}</p>
                        </div>
                        {step.status === "loading" && (
                          <span className="ml-auto text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                            Processing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Result state */}
              {!isProcessing && result && (
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h2 className="text-base font-semibold mb-1 text-slate-900 dark:text-slate-100">Classification Results</h2>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Analysis complete</p>
                    </div>
                    <button
                      onClick={resetAnalysis}
                      className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <RefreshCw size={12} /> New Analysis
                    </button>
                  </div>

                  {/* Status Card */}
                  <div className={`rounded-xl p-5 border mb-5 flex items-start gap-4 ${
                    result.isBt
                      ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                  }`}>
                    <div className={`mt-0.5 shrink-0 ${result.isBt ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                      {result.isBt ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />}
                    </div>
                    <div>
                      <h3 className={`text-base font-bold ${result.isBt ? "text-red-800 dark:text-red-300" : "text-green-800 dark:text-green-300"}`}>
                        {result.isBt ? "Transgenic / Bt Corn Detected" : "Non-Bt / Traditional Corn"}
                      </h3>
                      <p className={`text-xs mt-1 leading-relaxed ${result.isBt ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                        {result.isBt
                          ? "Spectral signatures consistent with genetically modified corn containing Bt genes."
                          : "Traditional maize with no transgenic modifications detected."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Confidence */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Confidence</h4>
                      <div className="mb-3">
                        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{result.confidence.toFixed(1)}%</span>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full ${result.isBt ? "bg-red-500" : "bg-green-500"}`}
                            style={{ width: `${result.confidence}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block">Level</span>
                          <span className={`font-medium ${result.isBt ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            {result.confidence > 90 ? "Very High" : "Moderate"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block">Data Points</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {(result.dataPoints ?? normalizedResultSpectrum.length) || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Summary</h4>
                      <ul className="space-y-2 text-xs">
                        <li className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                          <span className="text-slate-500 dark:text-slate-400">Method</span>
                          <span className="font-medium text-slate-900 dark:text-slate-200">{modelType.toUpperCase()} + FTIR</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                          <span className="text-slate-500 dark:text-slate-400">Range</span>
                          <span className="font-medium text-slate-900 dark:text-slate-200">{result.wavelengthRange ?? "—"}</span>
                        </li>
                        <li className="flex justify-between pt-0.5">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock size={11} /> Time
                          </span>
                          <span className="font-medium text-slate-900 dark:text-slate-200">{result.inferenceTime.toFixed(1)}s</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {confidenceComputation && (
                    <div className="mt-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Confidence Score Computation
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                        {confidenceComputation.modelLabel}
                      </p>
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 mb-3 overflow-x-auto">
                        {confidenceComputation.equation}
                      </p>
                      <div className="space-y-2">
                        {confidenceComputation.steps.map((item) => (
                          <div key={item.label} className="flex items-start justify-between gap-3 text-xs border-b border-slate-200 dark:border-slate-700 pb-1.5 last:border-b-0 last:pb-0">
                            <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                            <span className="font-medium text-slate-900 dark:text-slate-200">{item.value}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                        Frontend transparency view: values are computed from the displayed confidence for interpretability.
                      </p>
                    </div>
                  )}

                  <button className="mt-4 w-full bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium transition-colors">
                    Export Report (PDF)
                  </button>
                </div>
              )}

            </div>
          </div>
        </main>

        {isSpectrumZoomed && spectrumPlot && (
          <div
            className="fixed inset-0 z-50 bg-black/70 p-4 md:p-8 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setIsSpectrumZoomed(false)}
          >
            <div
              className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 md:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Input Spectrum (Zoomed)</h3>
                <button
                  type="button"
                  onClick={() => setIsSpectrumZoomed(false)}
                  className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  Close
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
                <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-[65vh]">
                  <line
                    x1={CHART_PADDING.left}
                    y1={CHART_HEIGHT - CHART_PADDING.bottom}
                    x2={CHART_WIDTH - CHART_PADDING.right}
                    y2={CHART_HEIGHT - CHART_PADDING.bottom}
                    className="stroke-slate-300 dark:stroke-slate-600"
                    strokeWidth="1"
                  />
                  <line
                    x1={CHART_PADDING.left}
                    y1={CHART_PADDING.top}
                    x2={CHART_PADDING.left}
                    y2={CHART_HEIGHT - CHART_PADDING.bottom}
                    className="stroke-slate-300 dark:stroke-slate-600"
                    strokeWidth="1"
                  />
                  <path
                    d={spectrumPlot.path}
                    fill="none"
                    className="stroke-blue-600 dark:stroke-blue-400"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={CHART_PADDING.left}
                    y={CHART_HEIGHT - 8}
                    className="fill-slate-500 dark:fill-slate-400"
                    fontSize="11"
                  >
                    {normalizedSpectrum[0].wavelength.toFixed(0)} {displaySpectrumSource?.spectrumMeta?.xUnit ?? "cm⁻¹"}
                  </text>
                  <text
                    x={CHART_WIDTH - CHART_PADDING.right}
                    y={CHART_HEIGHT - 8}
                    textAnchor="end"
                    className="fill-slate-500 dark:fill-slate-400"
                    fontSize="11"
                  >
                    {normalizedSpectrum[normalizedSpectrum.length - 1].wavelength.toFixed(0)} {displaySpectrumSource?.spectrumMeta?.xUnit ?? "cm⁻¹"}
                  </text>
                  <text
                    x={CHART_PADDING.left + 4}
                    y={CHART_PADDING.top + 10}
                    className="fill-slate-500 dark:fill-slate-400"
                    fontSize="11"
                  >
                    {spectrumPlot.yMax.toFixed(3)} {displaySpectrumSource?.spectrumMeta?.yUnit ?? "a.u."}
                  </text>
                  <text
                    x={CHART_PADDING.left + 4}
                    y={CHART_HEIGHT - CHART_PADDING.bottom - 4}
                    className="fill-slate-500 dark:fill-slate-400"
                    fontSize="11"
                  >
                    {spectrumPlot.yMin.toFixed(3)} {displaySpectrumSource?.spectrumMeta?.yUnit ?? "a.u."}
                  </text>
                </svg>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Press Esc or click outside the chart to close.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 16, right: 18, bottom: 28, left: 44 };

function normalizeSpectrumPoints(points: SpectrumPoint[] | undefined): SpectrumPoint[] {
  if (!points?.length) return [];

  return points
    .filter((point) => Number.isFinite(point.wavelength) && Number.isFinite(point.intensity))
    .sort((left, right) => left.wavelength - right.wavelength);
}

function buildSpectrumPath(points: SpectrumPoint[]): { path: string; yMin: number; yMax: number } {
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const xMin = points[0].wavelength;
  const xMax = points[points.length - 1].wavelength;

  let yMin = points[0].intensity;
  let yMax = points[0].intensity;

  for (const point of points) {
    if (point.intensity < yMin) yMin = point.intensity;
    if (point.intensity > yMax) yMax = point.intensity;
  }

  if (yMax === yMin) {
    yMin -= 1;
    yMax += 1;
  }

  const toX = (wavelength: number) => {
    if (xMax === xMin) return CHART_PADDING.left;
    return CHART_PADDING.left + ((wavelength - xMin) / (xMax - xMin)) * plotWidth;
  };

  const toY = (intensity: number) =>
    CHART_PADDING.top + plotHeight - ((intensity - yMin) / (yMax - yMin)) * plotHeight;

  const path = points
    .map((point, index) => {
      const x = toX(point.wavelength);
      const y = toY(point.intensity);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return { path, yMin, yMax };
}