import { useEffect } from 'react';
import { useRouter } from '../router/index.js';
import { useTranslation } from '../context/useTranslation.js';
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
  const { t } = useTranslation();

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
    <div className="w-full bg-white text-[#1A1A1A]">
      {/* =========================================================================
          HERO SECTION: RECREATED EXACTLY FROM CIVORA REFERENCE SCREENSHOT
          ========================================================================= */}
      <section
        className="relative w-full bg-white overflow-hidden flex flex-col justify-between pt-8 sm:pt-12 md:pt-14 pb-0"
        aria-label="Civora Hero"
      >
        {/* Upper Center Content: Headline & Action Buttons */}
        <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          {/* Centered Two-Tone Headline Matching Reference */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-bold tracking-tight leading-[1.12] max-w-4xl mx-auto font-sans">
            <span className="block text-[#1A1A1A]">The Voice of the People,</span>
            <span className="block text-[#0B6640] mt-1 sm:mt-2">The Will of the Nation.</span>
          </h1>

          {/* Action Buttons Directly Below Headline */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mt-6 sm:mt-8 w-full max-w-md mx-auto">
            <button
              type="button"
              onClick={() => navigate('/report')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md text-sm sm:text-base font-medium text-white bg-[#0B3D2E] hover:bg-[#072B20] transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D2E] cursor-pointer"
            >
              {t('home.reportCta')}
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/transparency')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md text-sm sm:text-base font-medium text-[#1A1A1A] bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 cursor-pointer"
            >
              {t('nav.transparency')}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        {/* Lower Composition: Sunburst Sky Rays + Parliament Illustration */}
        <div className="relative w-full max-w-6xl mx-auto mt-2 sm:mt-4 px-2 sm:px-4 flex justify-center items-end">
          {/* Radiating Light-Blue Rays Backdrop */}
          <div
            className="absolute inset-0 -top-16 sm:-top-24 md:-top-32 z-0 pointer-events-none bg-contain bg-bottom bg-no-repeat"
            style={{
              backgroundImage: "url('/parliament_sunburst.svg')",
            }}
            aria-hidden="true"
          />

          {/* Parliament Building and Citizens Assembly Image */}
          <img
            src="/parliament.png"
            alt="Parliament of India with Citizens Assembly"
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
        className="w-full py-20 sm:py-28 border-t border-gray-100 bg-[#FAF8F5] dark:bg-[#121A16]"
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
