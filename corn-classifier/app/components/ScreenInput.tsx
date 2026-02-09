import React from "react";
import { UploadCloud, FileCode, FileDigit, Database, ArrowRight } from "lucide-react";

type ScreenInputProps = {
  modelFile: File | null;
  spectralFile: File | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'model' | 'data') => void;
  onAnalyze: () => void;
};

export default function ScreenInput({ 
  modelFile, 
  spectralFile, 
  onUpload, 
  onAnalyze 
}: ScreenInputProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-8">
        <h2 className="text-lg font-semibold mb-1">Screen 1: Configuration & Input</h2>
        <p className="text-slate-500 text-sm mb-8">Upload custom model and spectral data for analysis</p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          
          {/* Zone A: Model */}
          <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-6 flex flex-col items-center text-center transition-all hover:border-orange-300">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
              <Database size={24} />
            </div>
            <h3 className="font-medium text-slate-900">Custom Model Upload</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Accepts .h5 (Keras) or .pkl (Scikit)</p>
            
            <label className="cursor-pointer bg-white border border-orange-200 text-slate-700 hover:text-orange-600 hover:border-orange-400 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
              <UploadCloud size={16} />
              {modelFile ? "Change File" : "Upload Model"}
              <input type="file" className="hidden" accept=".h5,.pkl" onChange={(e) => onUpload(e, 'model')} />
            </label>
            {modelFile && <span className="text-xs font-mono text-orange-700 mt-3 bg-orange-100 px-2 py-1 rounded">{modelFile.name}</span>}
          </div>

          {/* Zone B: Data */}
          <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-6 flex flex-col items-center text-center transition-all hover:border-blue-300">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <FileDigit size={24} />
            </div>
            <h3 className="font-medium text-slate-900">Data Ingestion</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Accepts .SPA or .CSV spectral files</p>
            
            <div className="w-full h-32 border-2 border-dashed border-blue-300 rounded-lg bg-white flex flex-col items-center justify-center p-4 relative hover:bg-blue-50 transition-colors">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                accept=".spa,.csv"
                onChange={(e) => onUpload(e, 'data')} 
              />
              {spectralFile ? (
                <>
                  <FileCode className="text-blue-500 mb-2" />
                  <span className="text-xs font-mono text-blue-700">{spectralFile.name}</span>
                </>
              ) : (
                <>
                  <span className="text-sm text-blue-900 font-medium">Drop file here</span>
                  <span className="text-xs text-slate-400 mt-1">or click to browse</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-100">
          <button 
            onClick={onAnalyze}
            disabled={!modelFile || !spectralFile}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm"
          >
            Analyze Sample <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
