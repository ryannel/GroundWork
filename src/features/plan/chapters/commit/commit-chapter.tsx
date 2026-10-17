import type { BodyProps } from '@/features/plan/screen-bodies';

import { AskScreen } from './ask-screen';
import { ChoicesScreen } from './choices-screen';
import { RegisterScreen } from './register-screen';
import { RisksScreen } from './risks-screen';

/** Chapter 8, what we commit to: the choices, the risks, the rest of the register, and what is still to settle. */
export function CommitChapter({ page, ...rest }: BodyProps) {
  switch (page.screen) {
    case 'choices': {
      return <ChoicesScreen {...rest} page={page} />;
    }
    case 'risks': {
      return <RisksScreen {...rest} page={page} />;
    }
    case 'register': {
      return <RegisterScreen {...rest} page={page} />;
    }
    default: {
      return <AskScreen {...rest} page={page} />;
    }
  }
}
