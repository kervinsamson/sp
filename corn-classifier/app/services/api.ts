/**
 * API Service Layer
 * 
 * This file centralizes all backend API calls.
 * To integrate with a real backend:
 * 1. Replace USE_MOCK_API with false (or use environment variable)
 * 2. Update API_BASE_URL to your backend URL
 * 3. The mock implementations will automatically be bypassed
 */

import { AnalysisRequest, AnalysisResponse, ProcessingStep } from "@/app/types";

// Configuration
const USE_MOCK_API = true; // Set to false when backend is ready
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types for progress callback
type ProgressCallback = (progress: number, steps: ProcessingStep[]) => void;

/**
 * Main analysis function that processes model and spectral files
 * @param request - Contains model and spectral files
 * @param onProgress - Callback for progress updates
 * @returns Analysis result
 */
export async function analyzeSpectralData(
  request: AnalysisRequest,
  onProgress?: ProgressCallback
): Promise<AnalysisResponse> {
  if (USE_MOCK_API) {
    return mockAnalyzeSpectralData(request, onProgress);
  }

  // Real API implementation (uncomment when backend is ready)
  /*
  const formData = new FormData();
  formData.append("model", request.modelFile);
  formData.append("spectral_data", request.spectralFile);

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  const result: AnalysisResponse = await response.json();
  return result;
  */
  
  throw new Error("Real API not implemented yet");
}

/**
 * Mock implementation for development/testing
 * Simulates the backend processing pipeline
 */
async function mockAnalyzeSpectralData(
  request: AnalysisRequest,
  onProgress?: ProgressCallback
): Promise<AnalysisResponse> {
  const steps: ProcessingStep[] = [
    { id: 1, label: "Loading Model", subLabel: "Retrieving trained 1D-CNN model (.h5)", status: "pending" },
    { id: 2, label: "Preprocessing", subLabel: "Applying Savitzky-Golay smoothing filter", status: "pending" },
    { id: 3, label: "Inferencing", subLabel: "Running spectral data through neural network", status: "pending" },
  ];

  // Stage 1: Load Model
  steps[0].status = "loading";
  onProgress?.(0, steps);
  await simulateProcessing(1000, 30, (p) => onProgress?.(p, steps));
  steps[0].status = "complete";

  // Stage 2: Preprocessing
  steps[1].status = "loading";
  onProgress?.(30, steps);
  await simulateProcessing(1500, 65, (p) => onProgress?.(p, steps));
  steps[1].status = "complete";

  // Stage 3: Inference
  steps[2].status = "loading";
  onProgress?.(65, steps);
  await simulateProcessing(1000, 100, (p) => onProgress?.(p, steps));
  steps[2].status = "complete";
  onProgress?.(100, steps);

  // Simulate random result (for demo purposes)
  const isBt = Math.random() > 0.5;
  
  return {
    isBt,
    confidence: 92 + Math.random() * 7, // 92-99%
    inferenceTime: 3.5 + Math.random() * 1.5, // 3.5-5.0s
    dataPoints: 601,
    wavelengthRange: "4000 - 10000 cm⁻¹",
  };
}

/**
 * Helper function to simulate gradual processing
 */
function simulateProcessing(
  duration: number,
  targetProgress: number,
  onTick: (progress: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    const startProgress = 0;
    const steps = 20;
    const interval = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = startProgress + (targetProgress - startProgress) * (currentStep / steps);
      onTick(Math.round(progress));

      if (currentStep >= steps) {
        clearInterval(timer);
        resolve();
      }
    }, interval);
  });
}

/**
 * Health check endpoint (for when backend is deployed)
 */
export async function checkBackendHealth(): Promise<boolean> {
  if (USE_MOCK_API) return true;

  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
