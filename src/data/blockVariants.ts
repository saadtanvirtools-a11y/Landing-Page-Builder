import type { BlockVariant } from '../types';

export const blockVariants: BlockVariant[] = [

  // ============================================
  // HERO
  // ============================================

  {
    blockType      : 'hero',
    variantId      : 1,
    label          : 'Hero — Centered',
    description    : 'Full-width centered hero with badge, headline & dual CTAs',
    defaultContent : {
      badge             : '🚀 New Product Launch',
      headline          : 'Build Something Amazing Today',
      subheadline       : 'The fastest way to create beautiful landing pages without writing a single line of code.',
      ctaText           : 'Get Started Free',
      ctaUrl            : '#',
      secondaryCtaText  : 'Watch Demo',
      secondaryCtaUrl   : '#',
    },
    defaultStyles  : {
      bgColor              : '#ffffff',
      headlineColor        : '#111827',
      subheadlineColor     : '#6b7280',
      badgeBg              : '#ede9fe',
      badgeColor           : '#7c3aed',
      ctaBg                : '#4f46e5',
      ctaColor             : '#ffffff',
      secondaryCtaBorder   : '#4f46e5',
      secondaryCtaColor    : '#4f46e5',
    },
  },

  {
    blockType      : 'hero',
    variantId      : 2,
    label          : 'Hero — Split',
    description    : 'Two-column hero with text left, image right',
    defaultContent : {
      badge             : '✨ Now Available',
      headline          : 'The Smart Way to Grow Your Business',
      subheadline       : 'Powerful tools designed for modern teams. Start free, scale fast.',
      ctaText           : 'Start Free Trial',
      ctaUrl            : '#',
      secondaryCtaText  : 'Learn More',
      secondaryCtaUrl   : '#',
      imageUrl          : '',
    },
    defaultStyles  : {
      bgColor              : '#f9fafb',
      headlineColor        : '#111827',
      subheadlineColor     : '#6b7280',
      badgeBg              : '#dbeafe',
      badgeColor           : '#1d4ed8',
      ctaBg                : '#4f46e5',
      ctaColor             : '#ffffff',
      secondaryCtaBorder   : '#4f46e5',
      secondaryCtaColor    : '#4f46e5',
      imageBg              : '#e0e7ff',
    },
  },

  // ============================================
  // FEATURES
  // ============================================

  {
    blockType      : 'features',
    variantId      : 1,
    label          : 'Features — 3 Column Grid',
    description    : 'Three feature cards in a grid layout',
    defaultContent : {
      headline    : 'Everything You Need',
      subheadline : 'Packed with powerful features to help you succeed.',
      features    : [
        {
          icon        : '⚡',
          title       : 'Lightning Fast',
          description : 'Optimized for speed so your pages load instantly.',
        },
        {
          icon        : '🎨',
          title       : 'Fully Customizable',
          description : 'Tailor every element to match your brand perfectly.',
        },
        {
          icon        : '🔒',
          title       : 'Secure by Default',
          description : 'Enterprise-grade security built in from day one.',
        },
      ],
    },
    defaultStyles  : {
      bgColor          : '#ffffff',
      headlineColor    : '#111827',
      subheadlineColor : '#6b7280',
      cardBg           : '#f9fafb',
      cardTitleColor   : '#111827',
      cardTextColor    : '#6b7280',
    },
  },

  {
    blockType      : 'features',
    variantId      : 2,
    label          : 'Features — Icon Left',
    description    : 'Two-column layout with icon on the left of each feature',
    defaultContent : {
      headline    : 'Why Teams Love Us',
      subheadline : 'Built for productivity, designed for simplicity.',
      features    : [
        {
          icon        : '📊',
          title       : 'Advanced Analytics',
          description : 'Get deep insights into your performance metrics.',
        },
        {
          icon        : '🤝',
          title       : 'Team Collaboration',
          description : 'Work together seamlessly in real time.',
        },
        {
          icon        : '🌍',
          title       : 'Global CDN',
          description : 'Deliver content fast to users anywhere in the world.',
        },
        {
          icon        : '🔧',
          title       : 'Easy Integrations',
          description : 'Connect with your favorite tools in one click.',
        },
      ],
    },
    defaultStyles  : {
      bgColor          : '#f9fafb',
      headlineColor    : '#111827',
      subheadlineColor : '#6b7280',
      cardBg           : '#ffffff',
      cardTitleColor   : '#111827',
      cardTextColor    : '#6b7280',
      iconBg           : '#ede9fe',
    },
  },

  // ============================================
  // BENEFITS
  // ============================================

  {
    blockType      : 'benefits',
    variantId      : 1,
    label          : 'Benefits — Image Right',
    description    : 'Numbered benefit list on left, image on right',
    defaultContent : {
      headline    : 'Why Choose Us?',
      subheadline : 'We help businesses grow faster with less effort.',
      imageUrl    : '',
      benefits    : [
        {
          title       : 'Save Time',
          description : 'Automate repetitive tasks and focus on what matters.',
        },
        {
          title       : 'Reduce Costs',
          description : 'Cut operational expenses by up to 40% in the first month.',
        },
        {
          title       : 'Grow Revenue',
          description : 'Proven strategies that drive measurable results.',
        },
      ],
    },
    defaultStyles  : {
      bgColor            : '#ffffff',
      headlineColor      : '#111827',
      subheadlineColor   : '#6b7280',
      numberBg           : '#4f46e5',
      numberColor        : '#ffffff',
      benefitTitleColor  : '#111827',
      benefitTextColor   : '#6b7280',
      imageBg            : '#e0e7ff',
    },
  },

  {
    blockType      : 'benefits',
    variantId      : 2,
    label          : 'Benefits — 4 Icon Cards',
    description    : 'Four benefit cards in a grid with icons',
    defaultContent : {
      headline    : 'The Benefits Speak for Themselves',
      subheadline : 'Join thousands of happy customers worldwide.',
      benefits    : [
        {
          icon        : '🏆',
          title       : 'Award Winning',
          description : 'Recognized by industry leaders globally.',
        },
        {
          icon        : '💬',
          title       : '24/7 Support',
          description : 'Our team is always here when you need us.',
        },
        {
          icon        : '📈',
          title       : 'Proven Results',
          description : '10x ROI for our average customer.',
        },
        {
          icon        : '🔄',
          title       : 'Always Improving',
          description : 'New features shipped every week.',
        },
      ],
    },
    defaultStyles  : {
      bgColor          : '#f9fafb',
      headlineColor    : '#111827',
      subheadlineColor : '#6b7280',
      cardBg           : '#ffffff',
      cardTitleColor   : '#111827',
      cardTextColor    : '#6b7280',
    },
  },

  // ============================================
  // FAQ
  // ============================================

  {
    blockType      : 'faq',
    variantId      : 1,
    label          : 'FAQ — Accordion',
    description    : 'Collapsible accordion style FAQ',
    defaultContent : {
      headline    : 'Frequently Asked Questions',
      subheadline : 'Everything you need to know.',
      faqs        : [
        {
          question : 'How do I get started?',
          answer   : 'Simply sign up for a free account and follow the onboarding steps. You will be up and running in minutes.',
        },
        {
          question : 'Is there a free plan?',
          answer   : 'Yes! Our free plan includes all core features with no credit card required.',
        },
        {
          question : 'Can I cancel anytime?',
          answer   : 'Absolutely. You can cancel your subscription at any time with no questions asked.',
        },
        {
          question : 'Do you offer customer support?',
          answer   : 'We offer 24/7 support via live chat and email for all plans.',
        },
      ],
    },
    defaultStyles  : {
      bgColor       : '#ffffff',
      headlineColor : '#111827',
      subheadlineColor : '#6b7280',
      borderColor   : '#e5e7eb',
      questionBg    : '#f9fafb',
      questionColor : '#111827',
      answerBg      : '#ffffff',
      answerColor   : '#6b7280',
    },
  },

  {
    blockType      : 'faq',
    variantId      : 2,
    label          : 'FAQ — 2 Column Grid',
    description    : 'FAQ items displayed in a two-column card grid',
    defaultContent : {
      headline    : 'Got Questions?',
      subheadline : 'We have got answers.',
      faqs        : [
        {
          question : 'What platforms do you support?',
          answer   : 'We support all major platforms including Web, iOS, and Android.',
        },
        {
          question : 'How secure is my data?',
          answer   : 'We use AES-256 encryption and are SOC2 Type II certified.',
        },
        {
          question : 'Can I import existing data?',
          answer   : 'Yes, we support CSV, JSON, and direct API imports.',
        },
        {
          question : 'What payment methods do you accept?',
          answer   : 'We accept all major credit cards, PayPal, and bank transfers.',
        },
      ],
    },
    defaultStyles  : {
      bgColor          : '#f9fafb',
      headlineColor    : '#111827',
      subheadlineColor : '#6b7280',
      cardBg           : '#ffffff',
      questionColor    : '#111827',
      answerColor      : '#6b7280',
    },
  },

  // ============================================
  // TESTIMONIALS
  // ============================================

  {
    blockType      : 'testimonials',
    variantId      : 1,
    label          : 'Testimonials — 3 Column',
    description    : 'Three testimonial cards in a grid',
    defaultContent : {
      headline     : 'What Our Customers Say',
      testimonials : [
        {
          text : 'This product completely transformed how our team works. Absolutely love it!',
          name : 'Sarah Johnson',
          role : 'CEO, TechCorp',
        },
        {
          text : 'The best investment we made this year. Setup was a breeze and results came fast.',
          name : 'Mark Williams',
          role : 'Founder, GrowthLab',
        },
        {
          text : 'Outstanding support and an incredibly intuitive interface. Highly recommended.',
          name : 'Emily Chen',
          role : 'Product Manager, Nexus',
        },
      ],
    },
    defaultStyles  : {
      bgColor      : '#f9fafb',
      headlineColor: '#111827',
      cardBg       : '#ffffff',
      textColor    : '#374151',
      avatarBg     : '#4f46e5',
      avatarColor  : '#ffffff',
      nameColor    : '#111827',
      roleColor    : '#6b7280',
    },
  },

  {
    blockType      : 'testimonials',
    variantId      : 2,
    label          : 'Testimonials — 2 Column Stars',
    description    : 'Two-column testimonials with star ratings',
    defaultContent : {
      headline     : 'Loved by Thousands',
      testimonials : [
        {
          text   : 'Incredible experience from start to finish. The team is world class.',
          name   : 'David Park',
          role   : 'CTO, Launchpad',
          rating : 5,
        },
        {
          text   : 'We saw a 3x increase in conversions within the first week. Mind blowing.',
          name   : 'Lisa Torres',
          role   : 'Marketing Director, Bloom',
          rating : 5,
        },
        {
          text   : 'Simple, powerful, and reliable. Everything we needed in one place.',
          name   : 'James Okafor',
          role   : 'Entrepreneur',
          rating : 5,
        },
        {
          text   : 'The onboarding was smooth and the results speak for themselves.',
          name   : 'Anna Schmidt',
          role   : 'Head of Growth, Velocity',
          rating : 5,
        },
      ],
    },
    defaultStyles  : {
      bgColor      : '#ffffff',
      headlineColor: '#111827',
      cardBg       : '#f9fafb',
      textColor    : '#374151',
      avatarBg     : '#4f46e5',
      avatarColor  : '#ffffff',
      nameColor    : '#111827',
      roleColor    : '#6b7280',
    },
  },

  // ============================================
  // CTA
  // ============================================

  {
    blockType      : 'cta',
    variantId      : 1,
    label          : 'CTA — Centered',
    description    : 'Full-width centered call to action',
    defaultContent : {
      headline    : 'Ready to Get Started?',
      subheadline : 'Join over 10,000 businesses already using our platform.',
      ctaText     : 'Start Free Today',
      ctaUrl      : '#',
    },
    defaultStyles  : {
      bgColor          : '#4f46e5',
      headlineColor    : '#ffffff',
      subheadlineColor : '#c7d2fe',
      ctaBg            : '#ffffff',
      ctaColor         : '#4f46e5',
    },
  },

  {
    blockType      : 'cta',
    variantId      : 2,
    label          : 'CTA — Banner',
    description    : 'Horizontal banner CTA with text left and button right',
    defaultContent : {
      headline    : 'Don\'t Miss Out — Limited Time Offer',
      subheadline : 'Get 3 months free when you sign up today.',
      ctaText     : 'Claim Your Offer',
      ctaUrl      : '#',
    },
    defaultStyles  : {
      bgColor          : '#f9fafb',
      cardBg           : '#4f46e5',
      headlineColor    : '#ffffff',
      subheadlineColor : '#c7d2fe',
      ctaBg            : '#ffffff',
      ctaColor         : '#4f46e5',
    },
  },

  // ============================================
  // FOOTER
  // ============================================

  {
    blockType      : 'footer',
    variantId      : 1,
    label          : 'Footer — Simple',
    description    : 'Minimal centered footer with brand and copyright',
    defaultContent : {
      brandName : 'YourBrand',
      tagline   : 'Building the future, one page at a time.',
      copyright : '© 2024 YourBrand. All rights reserved.',
    },
    defaultStyles  : {
      bgColor        : '#111827',
      brandColor     : '#ffffff',
      taglineColor   : '#9ca3af',
      copyrightColor : '#6b7280',
    },
  },

  {
    blockType      : 'footer',
    variantId      : 2,
    label          : 'Footer — With Links',
    description    : 'Footer with brand, navigation links and copyright',
    defaultContent : {
      brandName : 'YourBrand',
      copyright : '© 2024 YourBrand. All rights reserved.',
      links     : [
        { label : 'Privacy Policy', url : '#' },
        { label : 'Terms of Service', url : '#' },
        { label : 'Contact', url : '#' },
      ],
    },
    defaultStyles  : {
      bgColor        : '#111827',
      brandColor     : '#ffffff',
      linkColor      : '#9ca3af',
      copyrightColor : '#6b7280',
    },
  },

];

// ============================================
// HELPER — Group variants by blockType
// ============================================

export const getVariantsByType = (blockType: string): BlockVariant[] => {
  return blockVariants.filter((v) => v.blockType === blockType);
};

// ── All unique block types ────────────────────────────
export const blockTypes = [
  'hero',
  'features',
  'benefits',
  'faq',
  'testimonials',
  'cta',
  'footer',
] as const;

export type BlockType = typeof blockTypes[number];
