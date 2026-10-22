import { useState, useEffect, useCallback, useRef } from 'react';
import { getLeaderboard } from '@/lib/firebase-leaderboard';
import { LeaderboardEntry } from '@/integrations/firebase/types';
import { getFirestore, doc, onSnapshot, Unsubscribe } from 'firebase/firestore';

/**
 * Hook for fetching a specific student's rank position with real-time updates
 * 
 * Requirements: 4.6, 6.3, 6.5
 * - Uses database aggregation queries for efficient ranking calculation (6.3)
 * - Displays cached leaderboard data within 2 seconds of page load (6.5)
 * - Implements real-time listeners for rank changes with animation support (4.6)
 * 
 * @param departmentId - The department ID to fetch leaderboard from
 * @param studentId - The student ID to find rank for
 * @param enableRealtime - Enable real-time Firestore listeners (default: true)
 * @returns Object containing rank, stats, loading state, and rank change detection
 */
export function useStudentRank(
  departmentId: string | undefined,
  studentId: string | undefined,
  enableRealtime: boolean = true
) {
  const [rank, setRank] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [averageScore, setAverageScore] = useState<number>(0);
  const [examCount, setExamCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [previousRank, setPreviousRank] = useState<number | null>(null);
  
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const rankRef = useRef<number | null>(null);

  useEffect(() => {
    rankRef.current = rank;
  }, [rank]);

  const fetchStudentRank = useCallback(async () => {
    if (!departmentId || !studentId) {
      setLoading(false);
      setError('Department ID and Student ID are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await getLeaderboard(departmentId);
      const studentEntry = response.entries.find(
        (entry: LeaderboardEntry) => entry.studentId === studentId
      );

      if (studentEntry) {
        setPreviousRank((current) => current ?? rankRef.current);
        setRank(studentEntry.rankPosition);
        setTotalPoints(studentEntry.totalPoints);
        setAverageScore(studentEntry.averageScore);
        setExamCount(studentEntry.examCount);
        setError(null);
        setIsConnected(true);
      } else {
        setPreviousRank((current) => current ?? rankRef.current);
        setRank(null);
        setTotalPoints(0);
        setAverageScore(0);
        setExamCount(0);
        setError(null);
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Error fetching student rank:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch student rank');
      setIsConnected(false);
      if (rankRef.current === null) {
        setRank(null);
        setTotalPoints(0);
        setAverageScore(0);
        setExamCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId, studentId]);

  // Initial fetch on mount or when dependencies change
  useEffect(() => {
    fetchStudentRank();
  }, [fetchStudentRank]);

  // Set up real-time listener for leaderboard cache changes
  useEffect(() => {
    if (!departmentId || !studentId || !enableRealtime) {
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      const db = getFirestore();
      const cacheRef = doc(db, 'leaderboardCache', departmentId);
      const unsubscribe = onSnapshot(
        cacheRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const cacheData = snapshot.data();
            const now = Date.now();
            const expiresAt = cacheData.expiresAt?.toMillis();

            if (expiresAt && expiresAt >= now) {
              const entries = cacheData.entries || [];
              const studentEntry = entries.find(
                (entry: LeaderboardEntry) => entry.studentId === studentId
              );

              if (studentEntry) {
                setPreviousRank((current) => current ?? rankRef.current);
                setRank(studentEntry.rankPosition);
                setTotalPoints(studentEntry.totalPoints);
                setAverageScore(studentEntry.averageScore);
                setExamCount(studentEntry.examCount);
                setError(null);
                setIsConnected(true);
                setLoading(false);
              } else {
                setPreviousRank((current) => current ?? rankRef.current);
                setRank(null);
                setTotalPoints(0);
                setAverageScore(0);
                setExamCount(0);
                setError(null);
                setIsConnected(true);
                setLoading(false);
              }
            }
          }
        },
        (err) => {
          console.error('Error in student rank listener:', err);
          if (!err.message?.includes('No Firebase App')) {
            setError('Real-time connection lost');
            setIsConnected(false);
          }
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.error('Error setting up student rank listener:', err);
      const errorMessage = err instanceof Error ? err.message : '';
      if (!errorMessage.includes('No Firebase App')) {
        setError('Failed to set up real-time updates');
        setIsConnected(false);
      }
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [departmentId, studentId, enableRealtime]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    return fetchStudentRank();
  }, [fetchStudentRank]);

  // Helper function to get rank change for animations
  const getRankChange = useCallback(() => {
    if (previousRank === null || rank === null) {
      return 0;
    }
    // Positive value means moved up (lower rank number)
    return previousRank - rank;
  }, [previousRank, rank]);

  return {
    rank,
    totalPoints,
    averageScore,
    examCount,
    loading,
    error,
    isConnected,
    refetch,
    getRankChange
  };
}
