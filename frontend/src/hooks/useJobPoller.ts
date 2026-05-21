import { useEffect, useRef, useState } from "react";
import { getJobResult, getJobStatus } from "../api/pipeline";
import type { JobResult, JobStatus } from "../types";

interface UseJobPollerState {
  status: JobStatus["status"] | null;
  progress: number;
  result: JobResult | null;
  error: string | null;
}

export function useJobPoller(jobId: string | null): UseJobPollerState {
  const [status, setStatus] = useState<JobStatus["status"] | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function pollJob() {
      if (!jobId) {
        return;
      }

      try {
        const jobStatus = await getJobStatus(jobId);
        if (!isMounted) {
          return;
        }

        setStatus(jobStatus.status);
        setProgress(jobStatus.progress);
        setError(jobStatus.status === "FAILURE" ? jobStatus.message : null);

        if (jobStatus.status === "SUCCESS") {
          const jobResult = await getJobResult(jobId);
          if (!isMounted) {
            return;
          }
          setResult(jobResult);
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }

        if (jobStatus.status === "FAILURE" && intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch (pollError) {
        if (!isMounted) {
          return;
        }
        const message =
          pollError instanceof Error ? pollError.message : "Failed to fetch job status.";
        setError(message);
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    setStatus(null);
    setProgress(0);
    setResult(null);
    setError(null);

    if (jobId) {
      void pollJob();
      intervalRef.current = window.setInterval(() => {
        void pollJob();
      }, 2000);
    }

    return () => {
      isMounted = false;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  return { status, progress, result, error };
}
