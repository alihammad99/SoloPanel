import Router from 'preact-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Docs } from './pages/Docs';

export function App() {
  return (
    <Layout>
      <Router>
        <Home path="/" />
        <Docs path="/docs" />
      </Router>
    </Layout>
  );
}
