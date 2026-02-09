import React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { ProcessingStep } from "@/app/types";

type ScreenProcessingProps = {
  progress: number;
  steps: ProcessingStep[];
};

export default function ScreenProcessing({ progress, steps }: ScreenProcessingProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-1">Screen 2: Processing Pipeline</h2>
      <p className="text-slate-500 text-sm mb-8">Analyzing spectral data through neural network</p>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          <span>Overall Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step: ProcessingStep) => (
          <div 
            key={step.id} 
            className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
              step.status === 'loading' 
                ? 'border-blue-200 bg-blue-50/50' 
                : step.status === 'complete' 
                ? 'border-green-200 bg-green-50/50' 
                : 'border-slate-100'
            }`}
          >
            <div className="shrink-0">
              {step.status === 'loading' && <Loader2 className="animate-spin text-blue-600" size={20} />}
              {step.status === 'complete' && <CheckCircle2 className="text-green-600" size={20} />}
              {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
            </div>
            <div>
              <h4 className={`text-sm font-medium ${step.status === 'pending' ? 'text-slate-500' : 'text-slate-900'}`}>
                {step.label}
              </h4>
              <p className="text-xs text-slate-500">{step.subLabel}</p>
            </div>
            {step.status === 'loading' && (
              <span className="ml-auto text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                Processing
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
