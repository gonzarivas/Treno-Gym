import { useState, useEffect, useCallback } from 'react';

export function useSupabaseQuery<T>(
    queryFn: () => Promise<T>,
    deps: any[] = []
) {
    const [data, setData] = useState<T | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await queryFn();
            setData(result);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, refetch: fetchData };
}
