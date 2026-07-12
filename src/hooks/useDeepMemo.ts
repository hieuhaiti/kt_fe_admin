import { useMemo, useRef, type DependencyList } from 'react';
import isEqual from 'react-fast-compare';

function useDeepMemo<T>(callback: () => T, dependencies: DependencyList): T {
    const dependencyRef = useRef<DependencyList>(dependencies);

    if (!isEqual(dependencyRef.current, dependencies)) {
        dependencyRef.current = dependencies;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(callback, dependencyRef.current);
}

export default useDeepMemo;
