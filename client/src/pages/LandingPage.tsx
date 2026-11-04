import { useEffect } from 'react';
import { useRouter } from '../router/index.js';
import { useTranslation } from '../context/useTranslation.js';
import { Container } from '../components/layout/Container.js';
import { Button } from '../components/ui/Button.js';
import { LiquidButton } from '../components/ui/liquid-glass-button.js';
import {
  FileTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '../components/ui/icons.js';

export function LandingPage() {
  const { navigate } = useRouter();
  const { t } = useTranslation();

  // Handle smooth scroll to section if hash exists in URL on mount
  useEffect(() => {
    if (window.location.hash === '#about') {
      const el = document.getElementById('about');
      if (el) {
        const prefersReduced =
          document.documentElement.dataset.reducedMotion === 'true' ||
          window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
      }
    }
  }, []);

  return (
    <div className="w-full bg-white dark:bg-[#111827] text-[#1A1A1A] dark:text-[#F9FAFB] transition-colors">
      {/* =========================================================================
          HERO SECTION: RECREATED EXACTLY FROM CIVORA REFERENCE SCREENSHOT
          ========================================================================= */}
      <section
        className="relative w-full bg-white dark:bg-[#111827] overflow-hidden flex flex-col justify-between pt-8 sm:pt-12 md:pt-14 pb-0 transition-colors"
        aria-label="Civora Hero"
      >
        {/* Upper Center Content: Headline & Action Buttons */}
        <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          {/* Centered Two-Tone Headline Matching Reference */}
          <h1
            data-scroll-reveal="true"
            data-reveal-delay="0"
            data-reveal-distance="12"
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-bold tracking-tight leading-[1.12] max-w-4xl mx-auto font-sans"
          >
            <span className="block text-[#1A1A1A] dark:text-[#F9FAFB]">The Voice of the People,</span>
            <span className="block text-[#0B6640] dark:text-[#34D399] mt-1 sm:mt-2">The Will of the Nation.</span>
          </h1>

          {/* Action Buttons Directly Below Headline */}
          <div
            data-scroll-reveal="true"
            data-reveal-delay="85"
            data-reveal-distance="12"
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mt-6 sm:mt-8 w-full max-w-md mx-auto"
          >
            <LiquidButton
              variant="primary"
              size="lg"
              withGlassFilter
              onClick={() => navigate('/report')}
              className="w-full sm:w-auto px-6 py-2.5 text-sm sm:text-base font-medium"
              rightIcon={<span aria-hidden="true">→</span>}
            >
              {t('home.reportCta')}
            </LiquidButton>

            <LiquidButton
              variant="secondary"
              size="lg"
              withGlassFilter
              onClick={() => navigate('/transparency')}
              className="w-full sm:w-auto px-6 py-2.5 text-sm sm:text-base font-medium"
              rightIcon={<span aria-hidden="true">→</span>}
            >
              {t('nav.transparency')}
            </LiquidButton>
          </div>
        </div>

        {/* Lower Composition: Sunburst Sky Rays + Parliament Illustration */}
        <div className="relative w-full max-w-6xl mx-auto mt-2 sm:mt-4 px-2 sm:px-4 flex justify-center items-end">
          {/* Radiating Light-Blue Rays Backdrop (Light Mode) */}
          <div
            className="absolute inset-0 -top-16 sm:-top-24 md:-top-32 z-0 pointer-events-none bg-contain bg-bottom bg-no-repeat dark:hidden"
            style={{
              backgroundImage: "url('/parliament_sunburst.svg')",
            }}
            aria-hidden="true"
          />

          {/* Calm Slate-Emerald Twilight Rays Backdrop (Dark Mode) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMax meet"
            className="hidden dark:block absolute inset-0 -top-16 sm:-top-24 md:-top-32 z-0 w-full h-full pointer-events-none select-none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="darkSunburstFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                <stop offset="28%" stopColor="#FFFFFF" stopOpacity="0.22" />
                <stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
              </linearGradient>
              <radialGradient id="darkDomeHorizon" cx="50%" cy="68%" r="48%">
                <stop offset="0%" stopColor="#273548" stopOpacity="0.75" />
                <stop offset="55%" stopColor="#182230" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#111827" stopOpacity="0" />
              </radialGradient>
              <mask id="darkSunburstMask">
                <rect width="1600" height="900" fill="url(#darkSunburstFade)" />
              </mask>
            </defs>
            <rect width="1600" height="900" fill="url(#darkDomeHorizon)" />
            <g mask="url(#darkSunburstMask)" fill="#1E2D3D" opacity="0.75">
              <polygon points="800,540 -594.7,662.0 -600.0,544.9" />
              <polygon points="800,540 -594.7,418.0 -579.6,301.7" />
              <polygon points="800,540 -552.3,177.7 -517.2,65.8" />
              <polygon points="800,540 -468.8,-51.7 -414.9,-155.8" />
              <polygon points="800,540 -346.8,-263.0 -275.6,-356.2" />
              <polygon points="800,540 -189.9,-449.9 -103.6,-529.3" />
              <polygon points="800,540 -3.0,-606.8 95.8,-670.0" />
              <polygon points="800,540 208.3,-728.8 316.6,-773.9" />
              <polygon points="800,540 437.7,-812.3 552.1,-837.9" />
              <polygon points="800,540 678.0,-854.7 795.1,-860.0" />
              <polygon points="800,540 922.0,-854.7 1038.3,-839.6" />
              <polygon points="800,540 1162.3,-812.3 1274.2,-777.2" />
              <polygon points="800,540 1391.7,-728.8 1495.8,-674.9" />
              <polygon points="800,540 1603.0,-606.8 1696.2,-535.6" />
              <polygon points="800,540 1789.9,-449.9 1869.3,-363.6" />
              <polygon points="800,540 1946.8,-263.0 2010.0,-164.2" />
              <polygon points="800,540 2068.8,-51.7 2113.9,56.6" />
              <polygon points="800,540 2152.3,177.7 2177.9,292.1" />
              <polygon points="800,540 2194.7,418.0 2200.0,535.1" />
              <polygon points="800,540 2194.7,662.0 2179.6,778.3" />
            </g>
          </svg>

          {/* Parliament Building and Citizens Assembly Image */}
          <img
            src="/parliament.png"
            alt="Parliament of India with Citizens Assembly"
            data-scroll-reveal="true"
            data-reveal-delay="160"
            data-reveal-distance="14"
            data-reveal-duration="680"
            className="relative z-10 w-full max-w-5xl h-auto object-contain select-none pointer-events-none"
            loading="eager"
          />
        </div>
      </section>

      {/* =========================================================================
          SECTION: ABOUT CIVORA (Refined Civic Mandate & Architectural Pillars)
          ========================================================================= */}
      <section
        id="about"
        className="w-full py-20 sm:py-28 border-t border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] transition-colors"
        aria-labelledby="about-civora-heading"
      >
        <Container size="xl" className="space-y-16">
          {/* Section Introduction */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span
              data-scroll-reveal="true"
              data-reveal-delay="0"
              data-reveal-distance="10"
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-sm font-semibold bg-[#E5ECE8] text-[#0B3D2E] dark:bg-[#34D399]/15 dark:text-[#6EE7B7] dark:border dark:border-[#34D399]/25 font-mono uppercase tracking-wider"
            >
              Governance Covenant
            </span>
            <h2
              id="about-civora-heading"
              data-scroll-reveal="true"
              data-reveal-delay="60"
              data-reveal-distance="12"
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB]"
            >
              Democracy in Action
            </h2>
            <blockquote
              data-scroll-reveal="true"
              data-reveal-delay="115"
              data-reveal-distance="12"
              className="text-xl sm:text-2xl font-serif text-[#374151] dark:text-[#D1D5DB] italic leading-relaxed pt-1"
            >
              &ldquo;People form the government. Government exists to serve the people.&rdquo;
            </blockquote>
            <p
              data-scroll-reveal="true"
              data-reveal-delay="165"
              data-reveal-distance="12"
              className="text-base sm:text-lg text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed max-w-2xl mx-auto"
            >
              Civora bridges the gap between citizens and municipal administrators. By introducing transparent SLA timelines, photographic verification, and tamper-evident tracking, civic issue resolution becomes an open public standard.
            </p>
          </div>

          {/* Three Focused Architectural Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Pillar 1 */}
            <div
              data-scroll-reveal="true"
              data-reveal-delay="0"
              data-reveal-distance="16"
              className="p-8 rounded-2xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] shadow-2xs flex flex-col justify-between space-y-4 hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-colors"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5ECE8] dark:bg-[#273548] text-[#0B3D2E] dark:text-[#34D399] flex items-center justify-center border border-[#0B3D2E]/15 dark:border-[#374151]">
                  <FileTextIcon className="w-5 h-5" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-[#F9FAFB]">
                  Direct Civic Reporting
                </h3>
                <p className="text-sm sm:text-base text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                  Lodge complaints with verified GPS geolocation and automatic department dispatch. Receive an immutable tracking ID instantly without bureaucratic barriers.
                </p>
              </div>
              <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#374151]">
                <LiquidButton
                  variant="text"
                  size="sm"
                  onClick={() => navigate('/report')}
                  className="px-2.5 -ml-2.5 font-semibold text-base"
                  rightIcon={<ArrowRightIcon className="w-3.5 h-3.5" />}
                >
                  File an issue now
                </LiquidButton>
              </div>
            </div>

            {/* Pillar 2 */}
            <div
              data-scroll-reveal="true"
              data-reveal-delay="85"
              data-reveal-distance="16"
              className="p-8 rounded-2xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] shadow-2xs flex flex-col justify-between space-y-4 hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-colors"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5ECE8] dark:bg-[#273548] text-[#0B3D2E] dark:text-[#34D399] flex items-center justify-center border border-[#0B3D2E]/15 dark:border-[#374151]">
                  <ClockIcon className="w-5 h-5" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-[#F9FAFB]">
                  Enforced SLA Deadlines
                </h3>
                <p className="text-sm sm:text-base text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                  Municipal departments operate under binding response and resolution time targets. Unaddressed complaints escalate automatically to senior supervisory officials.
                </p>
              </div>
              <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#374151]">
                <LiquidButton
                  variant="text"
                  size="sm"
                  onClick={() => navigate('/transparency')}
                  className="px-2.5 -ml-2.5 font-semibold text-base"
                  rightIcon={<ArrowRightIcon className="w-3.5 h-3.5" />}
                >
                  View SLA performance
                </LiquidButton>
              </div>
            </div>

            {/* Pillar 3 */}
            <div
              data-scroll-reveal="true"
              data-reveal-delay="170"
              data-reveal-distance="16"
              className="p-8 rounded-2xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] shadow-2xs flex flex-col justify-between space-y-4 hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50 transition-colors"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5ECE8] dark:bg-[#273548] text-[#0B6640] dark:text-[#34D399] flex items-center justify-center border border-[#0B3D2E]/15 dark:border-[#374151]">
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-[#F9FAFB]">
                  Verified Resolution Proof
                </h3>
                <p className="text-sm sm:text-base text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                  No complaint can be silently dismissed. Field teams must upload timestamped, geoverified before-and-after photographic evidence, subject to citizen confirmation.
                </p>
              </div>
              <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#374151]">
                <LiquidButton
                  variant="text"
                  size="sm"
                  onClick={() => navigate('/track')}
                  className="px-2.5 -ml-2.5 font-semibold text-base"
                  rightIcon={<ArrowRightIcon className="w-3.5 h-3.5" />}
                >
                  Track an existing case
                </LiquidButton>
              </div>
            </div>
          </div>

          {/* Restrained Bottom Civic Banner */}
          <div
            data-scroll-reveal="true"
            data-reveal-delay="40"
            data-reveal-distance="16"
            className="p-8 sm:p-10 rounded-2xl bg-[#0B3D2E] dark:bg-[#1F2937] text-white dark:text-[#F9FAFB] border border-[#072B20] dark:border-[#374151] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors"
          >
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl font-bold text-white dark:text-[#F9FAFB] tracking-tight">
                Shape Your Community
              </h3>
              <p className="text-sm sm:text-base text-white/85 dark:text-[#D1D5DB] max-w-xl leading-relaxed">
                Beyond filing complaints, participate in civic decisions. Explore community improvement proposals and participate in verified public polls.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/engagement')}
                className="font-semibold text-[#0B3D2E] dark:text-[#F9FAFB]"
              >
                Civic Engagement Hub
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/transparency')}
                className="civora-liquid-btn--inverse font-semibold"
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
