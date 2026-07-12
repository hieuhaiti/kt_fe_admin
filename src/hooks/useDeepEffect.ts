import { useEffect, useRef, type EffectCallback, type DependencyList } from 'react'
import isEqual from 'react-fast-compare'

const useDeepEffect = (callback: EffectCallback, dependencies: DependencyList): void => {
  const dependencyRef = useRef<DependencyList>(dependencies)

  if (!isEqual(dependencyRef.current, dependencies)) {
    dependencyRef.current = dependencies
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, dependencyRef.current)
}

export default useDeepEffect
