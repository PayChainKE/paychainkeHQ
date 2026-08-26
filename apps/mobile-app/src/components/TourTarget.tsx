import React, { useEffect, useRef } from 'react';
import { View, ViewProps } from 'react-native';
import { registerTourTarget, unregisterTourTarget } from '../utils/tourTargets';

type Props = ViewProps & {
  id: string;
  children: React.ReactNode;
};

// Wraps a real UI element (a button, a card, a section) so SpotlightTour can
// find and measure it later by `id` — the mobile equivalent of adding
// data-tour="..." to a DOM node on web. `collapsable={false}` is required on
// Android: without it, RN's view-flattening optimizer can drop this View
// from the native tree entirely (since it would otherwise look like a
// redundant single-child wrapper), which silently breaks measureInWindow.
export default function TourTarget({ id, children, style, ...rest }: Props) {
  const ref = useRef<View>(null);

  useEffect(() => {
    registerTourTarget(id, ref);
    return () => unregisterTourTarget(id);
  }, [id]);

  return (
    <View ref={ref} collapsable={false} style={style} {...rest}>
      {children}
    </View>
  );
}
