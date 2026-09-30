import { route } from '@/router';
import { Home } from '@/screens/Home';
import { StreakStart } from '@/screens/streak/StreakStart';
import { ExamRoutes } from '@/screens/exam/Exam';
import { PracticeRoutes } from '@/screens/practice/Practice';
import { Stats } from '@/screens/Stats';
import { Settings } from '@/screens/Settings';
import { SignLexicon } from '@/screens/SignLexicon';

export function App() {
  const head = route.value.parts[0];
  switch (head) {
    case 'streak':
      return <StreakStart />;
    case 'exam':
      return <ExamRoutes />;
    case 'practice':
      return <PracticeRoutes />;
    case 'signs':
      return <SignLexicon />;
    case 'stats':
      return <Stats />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}
