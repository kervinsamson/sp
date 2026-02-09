import React from "react";
import { CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { AnalysisResult } from "@/app/types";

type ScreenResultProps = {
  result: AnalysisResult;
  onReset: () => void;
};

export default function ScreenResult({ result, onReset }: ScreenResultProps) {
  const isBt = result.isBt;
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Screen 3: Classification Dashboard</h2>
            <p className="text-slate-500 text-sm">Analysis complete - Review results below</p>
          </div>
          <button 
            onClick={onReset}
            className="text-slate-600 hover:text-blue-600 text-sm font-medium flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} /> New Analysis
          </button>
        </div>

        {/* Status Card */}
        <div className={`rounded-xl p-6 border mb-8 flex items-start gap-5 ${
          isBt ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className={`mt-1 ${isBt ? 'text-red-600' : 'text-green-600'}`}>
            {isBt ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isBt ? 'text-red-800' : 'text-green-800'}`}>
              {isBt ? 'Transgenic / Bt Corn Detected' : 'Non-Bt / Traditional Corn'}
            </h3>
            <p className={`text-sm mt-1 leading-relaxed ${isBt ? 'text-red-700' : 'text-green-700'}`}>
              {isBt 
                ? "The sample shows spectral signatures consistent with genetically modified corn containing Bt genes."
                : "The sample appears to be traditional maize with no transgenic modifications detected."
              }
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Confidence Metrics */}
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Confidence Metrics</h4>
            
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-bold text-slate-900">{result.confidence.toFixed(1)}%</span>
                <span className="text-xs text-slate-500 mb-1">Classification Confidence</span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${isBt ? 'bg-red-500' : 'bg-green-500'}`} 
                  style={{ width: `${result.confidence}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Confidence Level</span>
                <span className={`font-medium ${isBt ? 'text-red-600' : 'text-green-600'}`}>
                  {result.confidence > 90 ? 'Very High' : 'Moderate'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Data Points</span>
                <span className="font-medium text-slate-700">601</span>
              </div>
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Analysis Summary</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Sample Type</span>
                  <span className="font-medium text-slate-900">Corn (Zea mays)</span>
                </li>
                <li className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Analysis Method</span>
                  <span className="font-medium text-slate-900">FTIR Spectroscopy</span>
                </li>
                <li className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Wavelength Range</span>
                  <span className="font-medium text-slate-900">4000 - 10000 cm⁻¹</span>
                </li>
                <li className="flex justify-between pt-1">
                  <span className="text-slate-500 flex items-center gap-1"><Clock size={14}/> Processing Time</span>
                  <span className="font-medium text-slate-900">{result.inferenceTime.toFixed(1)}s</span>
                </li>
              </ul>
            </div>
            
            <button className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Export Report (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
