/**
 * mobile/theme/typography.ts
 * 
 * Typography scale and weights for React Native.
 */

import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  hero: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  title1: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3
  },
  title2: {
    fontSize: 18,
    fontWeight: '800'
  },
  title3: {
    fontSize: 15,
    fontWeight: '700'
  },
  body: {
    fontSize: 14,
    fontWeight: '500'
  },
  caption: {
    fontSize: 12,
    fontWeight: '600'
  },
  small: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  mono: {
    fontSize: 14,
    fontWeight: '900'
  }
};

export default Typography;
