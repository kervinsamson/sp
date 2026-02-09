"use client";

import React, { useState } from "react";
import ScreenInput from "@/app/components/ScreenInput";
import ScreenProcessing from "@/app/components/ScreenProcessing";
import ScreenResult from "@/app/components/ScreenResult";
import { analyzeSpectralData } from "@/app/services/api";
import { AnalysisResult, ProcessingStep, ScreenStep } from "@/app/types";

export default function Home() {
  // --- State Management ---
  const [step, setStep] = useState<ScreenStep>(1);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [spectralFile, setSpectralFile] = useState<File | null>(null);
  
  // Processing State
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 1, label: "Loading Model", subLabel: "Retrieving trained 1D-CNN model (.h5)", status: "pending" },
    { id: 2, label: "Preprocessing", subLabel: "Applying Savitzky-Golay smoothing filter", status: "pending" },
    { id: 3, label: "Inferencing", subLabel: "Running spectral data through neural network", status: "pending" },
  ]);

  // Result State
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'model' | 'data') => {
    if (e.target.files && e.target.files[0]) {
      if (type === 'model') setModelFile(e.target.files[0]);
      else setSpectralFile(e.target.files[0]);
    }
  };

  const startAnalysis = async () => {
    if (!modelFile || !spectralFile) return;

    setStep(2);
    setProgress(0);
    
    // Reset steps
    setSteps(s => s.map(step => ({...step, status: "pending"})));

    try {
      // Call the API service - this will use mock data now,
      // but can easily be switched to real backend later
      const analysisResult = await analyzeSpectralData(
        { modelFile, spectralFile },
        (progress, updatedSteps) => {
          setProgress(progress);
          setSteps(updatedSteps);
        }
      );

      setResult(analysisResult);
      setTimeout(() => setStep(3), 500);
    } catch (error) {
      console.error("Analysis failed:", error);
      // TODO: Add error handling UI
      alert("Analysis failed. Please try again.");
      setStep(1);
    }
  };

  const resetPipeline = () => {
    setModelFile(null);
    setSpectralFile(null);
    setStep(1);
    setProgress(0);
    setResult(null);
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Corn Spectral Classification System
          </h1>
          <p className="text-slate-500 text-sm mt-1">FTIR-based Transgenic Detection Pipeline</p>
        </header>

        {/* Dynamic Screens */}
        <main>
          {step === 1 && (
            <ScreenInput 
              modelFile={modelFile}
              spectralFile={spectralFile}
              onUpload={handleFileUpload}
              onAnalyze={startAnalysis}
            />
          )}

          {step === 2 && (
            <ScreenProcessing 
              progress={progress} 
              steps={steps} 
            />
          )}

          {step === 3 && result && (
            <ScreenResult 
              result={result} 
              onReset={resetPipeline} 
            />
          )}
        </main>
      </div>
    </div>
  );
}