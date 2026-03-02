import { useState, useEffect, useCallback, useRef } from 'react';

export function useSupabaseQuery<T>(
    queryFn: () => Promise<T>,
    deps: any[] = []
) {
    const [data, setData] = useState<T | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const fetchIdRef = useRef(0);

    const fetchData = useCallback(async () => {
        const id = ++fetchIdRef.current;
        setIsLoading(true);
        try {
            const result = await queryFn();
            if (id === fetchIdRef.current) {
                setData(result);
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            if (id === fetchIdRef.current) {
                setIsLoading(false);
            }
        }
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, refetch: fetchData };
}
