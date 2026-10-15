import type { BodyProps } from '@/features/plan/screen-bodies';

import { AskScreen } from './ask-screen';
import { ChoicesScreen } from './choices-screen';
import { RegisterScreen } from './register-screen';
import { RisksScreen } from './risks-screen';

/** Chapter 8, what we commit to: the choices, the risks, the rest of the register, and what is still to settle. */
export function CommitChapter(props: BodyProps) {
  switch (props.page.screen) {
    case 'choices': {
      return <ChoicesScreen {...props} />;
    }
    case 'risks': {
      return <RisksScreen {...props} />;
    }
    case 'register': {
      return <RegisterScreen {...props} />;
    }
    default: {
      return <AskScreen {...props} />;
    }
  }
}
