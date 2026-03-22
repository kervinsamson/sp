// Type definitions for the Corn Classifier application

export type AnalysisResult = {
  isBt: boolean;
  confidence: number;
  inferenceTime: number;
};

export type ModelType = "1d-cnn" | "svm" | "pls-da";

export type ProcessingStep = {
  id: number;
  label: string;
  subLabel: string;
  status: "pending" | "loading" | "complete";
};

export type ScreenStep = 1 | 2 | 3;

// API Request/Response types for backend integration
export type AnalysisRequest = {
  modelFile: File;
  spectralFile: File;
  modelType: ModelType;
};

export type AnalysisResponse = {
  isBt: boolean;
  confidence: number;
  inferenceTime: number;
  dataPoints?: number;
  wavelengthRange?: string;
};
