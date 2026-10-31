import { useEffect } from 'react';
import { useRouter } from '../router/index.js';
import { Container } from '../components/layout/Container.js';
import { Button } from '../components/ui/Button.js';
import {
  FileTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '../components/ui/icons.js';

export function LandingPage() {
  const { navigate } = useRouter();

  // Handle smooth scroll to section if hash exists in URL on mount
  useEffect(() => {
    if (window.location.hash === '#about') {
      const el = document.getElementById('about');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  return (
    <div className="w-full bg-[var(--color-background)] text-[var(--color-text-primary)]">
      {/* =========================================================================
          HERO SECTION: THE MAIN VISUAL EXPERIENCE (Tesla-Inspired Minimalist Focus)
          ========================================================================= */}
      <section
        className="relative w-full min-h-[calc(100vh-56px)] h-[90vh] min-h-[620px] max-h-[1080px] flex flex-col justify-between overflow-hidden"
        aria-label="Civora Hero"
      >
        {/* Full-bleed Architectural Background with Subtle Readability Overlay */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 ease-out will-change-transform"
          style={{
            backgroundImage: `
              linear-gradient(to bottom, rgba(244, 240, 230, 0.78) 0%, rgba(244, 240, 230, 0.55) 45%, rgba(244, 240, 230, 0.96) 100%),
              url('/parliament_hero.jpg'),
              url('/parliament_hero_backdrop.svg')
            `,
          }}
          aria-hidden="true"
        />

        {/* Ambient Top Vignette for Contrast */}
        <div
          className="absolute inset-0 z-0 bg-radial-at-t from-transparent via-transparent to-[#173D32]/10 pointer-events-none"
          aria-hidden="true"
        />

        {/* Center Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto py-12 md:py-16">
          {/* Restrained Civora Emblem Brand Insignia */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-[#16201C]/90 border border-[#DED8CB] dark:border-[#283931] shadow-xs backdrop-blur-md mb-6 sm:mb-8 transition-transform hover:scale-[1.02]">
            <img
              src="/civora_icon.jpeg"
              alt="Civora Emblem"
              className="h-5 sm:h-5.5 w-auto object-contain"
            />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#173D32] dark:text-[#7BC4B2] font-mono">
              Public Accountability Platform
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-heading font-extrabold tracking-tight text-[#173D32] dark:text-[#F4F0E6] leading-[1.06] max-w-4xl mx-auto drop-shadow-xs">
            Your Voice. Your City.
          </h1>

          {/* Supporting Motto */}
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-[#202522] dark:text-[#C5D4C9] max-w-2xl mx-auto mt-4 sm:mt-5 leading-relaxed tracking-normal">
            People First. Public Accountability Always.
          </p>

          {/* Minimal Purposeful Call-to-Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 pt-8 sm:pt-10 w-full max-w-md mx-auto">
            <Button
              size="lg"
              variant="primary"
              onClick={() => navigate('/report')}
              className="w-full sm:w-auto px-8 py-3.5 text-sm sm:text-base font-semibold rounded-full shadow-md bg-[#173D32] hover:bg-[#112F26] text-[#F4F0E6] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Report an Issue
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/transparency')}
              className="w-full sm:w-auto px-8 py-3.5 text-sm sm:text-base font-semibold rounded-full border border-[#DED8CB] bg-white/85 hover:bg-white text-[#173D32] dark:bg-[#1C2823] dark:text-[#F4F0E6] dark:border-[#283931] shadow-xs hover:shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Explore Transparency
            </Button>
          </div>
        </div>

        {/* Subtle Bottom Scroll Cue */}
        <div className="relative z-10 pb-6 sm:pb-8 flex flex-col items-center justify-center">
          <a
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById('about');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group flex flex-col items-center gap-1.5 text-xs font-medium text-[#54625A] dark:text-[#A8BFAE] hover:text-[#173D32] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] rounded-full p-2"
            aria-label="Scroll to About Civora section"
          >
            <span className="tracking-widest uppercase text-[10px] font-semibold opacity-80 group-hover:opacity-100">
              Discover Civora
            </span>
            <svg
              className="w-4 h-4 animate-bounce text-[#173D32] dark:text-[#7BC4B2]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </section>

      {/* =========================================================================
          SECTION: ABOUT CIVORA (Refined Civic Mandate & Architectural Pillars)
          ========================================================================= */}
      <section
        id="about"
        className="w-full py-20 sm:py-28 border-t border-[#DED8CB]/70 dark:border-[#283931]/70 bg-[#FAF8F5] dark:bg-[#121A16]"
        aria-labelledby="about-civora-heading"
      >
        <Container size="lg" className="space-y-16">
          {/* Section Introduction */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#173D32]/10 text-[#173D32] dark:bg-[#4F9B8B]/20 dark:text-[#7BC4B2] font-mono uppercase tracking-wider">
              Governance Covenant
            </span>
            <h2
              id="about-civora-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold tracking-tight text-[#202522] dark:text-[#F4F0E6]"
            >
              Democracy in Action
            </h2>
            <blockquote className="text-lg sm:text-xl font-serif text-[#3E4B44] dark:text-[#C5D4C9] italic leading-relaxed pt-1">
              &ldquo;People form the government. Government exists to serve the people.&rdquo;
            </blockquote>
            <p className="text-sm sm:text-base text-[#54625A] dark:text-[#A8BFAE] leading-relaxed max-w-2xl mx-auto">
              Civora bridges the gap between citizens and municipal administrators. By introducing transparent SLA timelines, photographic verification, and tamper-evident tracking, civic issue resolution becomes an open public standard.
            </p>
          </div>

          {/* Three Focused Architectural Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Pillar 1 */}
            <div className="p-8 rounded-2xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4F0E6] dark:bg-[#1D2A25] text-[#173D32] dark:text-[#7BC4B2] flex items-center justify-center border border-[#DED8CB] dark:border-[#283931]">
                  <FileTextIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-heading font-bold text-[#202522] dark:text-[#F4F0E6]">
                  Direct Civic Reporting
                </h3>
                <p className="text-xs sm:text-sm text-[#54625A] dark:text-[#C5D4C9] leading-relaxed">
                  Lodge complaints with verified GPS geolocation and automatic department dispatch. Receive an immutable tracking ID instantly without bureaucratic barriers.
                </p>
              </div>
              <div className="pt-2 border-t border-[#EAE5D9] dark:border-[#283931]">
                <button
                  type="button"
                  onClick={() => navigate('/report')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173D32] dark:text-[#7BC4B2] hover:underline"
                >
                  File an issue now <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-2xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4F0E6] dark:bg-[#1D2A25] text-[#173D32] dark:text-[#7BC4B2] flex items-center justify-center border border-[#DED8CB] dark:border-[#283931]">
                  <ClockIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-heading font-bold text-[#202522] dark:text-[#F4F0E6]">
                  Enforced SLA Deadlines
                </h3>
                <p className="text-xs sm:text-sm text-[#54625A] dark:text-[#C5D4C9] leading-relaxed">
                  Municipal departments operate under binding response and resolution time targets. Unaddressed complaints escalate automatically to senior supervisory officials.
                </p>
              </div>
              <div className="pt-2 border-t border-[#EAE5D9] dark:border-[#283931]">
                <button
                  type="button"
                  onClick={() => navigate('/transparency')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173D32] dark:text-[#7BC4B2] hover:underline"
                >
                  View SLA performance <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-2xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4F0E6] dark:bg-[#1D2A25] text-[#185541] dark:text-[#78C7AE] flex items-center justify-center border border-[#DED8CB] dark:border-[#283931]">
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-heading font-bold text-[#202522] dark:text-[#F4F0E6]">
                  Verified Resolution Proof
                </h3>
                <p className="text-xs sm:text-sm text-[#54625A] dark:text-[#C5D4C9] leading-relaxed">
                  No complaint can be silently dismissed. Field teams must upload timestamped, geoverified before-and-after photographic evidence, subject to citizen confirmation.
                </p>
              </div>
              <div className="pt-2 border-t border-[#EAE5D9] dark:border-[#283931]">
                <button
                  type="button"
                  onClick={() => navigate('/track')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173D32] dark:text-[#7BC4B2] hover:underline"
                >
                  Track an existing case <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Restrained Bottom Civic Banner */}
          <div className="p-8 sm:p-10 rounded-2xl bg-[#173D32] text-[#F4F0E6] border border-[#112F26] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight">
                Shape Your Community
              </h3>
              <p className="text-xs sm:text-sm text-[#C5D4C9] max-w-xl leading-relaxed">
                Beyond filing complaints, participate in civic decisions. Explore community improvement proposals and participate in verified public polls.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/engagement')}
                className="bg-[#F4F0E6] text-[#173D32] hover:bg-white border-transparent"
              >
                Civic Engagement Hub
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/transparency')}
                className="border-[#A8BFAE] text-[#F4F0E6] hover:bg-[#112F26] hover:text-white"
              >
                Public Transparency
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
