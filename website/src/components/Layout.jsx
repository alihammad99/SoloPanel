import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function Layout({ children }) {
  return (
    <div class="min-h-screen flex flex-col">
      <Navbar />
      <main class="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
