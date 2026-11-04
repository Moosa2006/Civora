import { Navbar } from './Navbar.js';

/**
 * Consolidated alias: HomepageNavbar and Navbar now share one single global
 * navigation implementation across all Civora routes.
 */
export function HomepageNavbar() {
  return <Navbar />;
}
