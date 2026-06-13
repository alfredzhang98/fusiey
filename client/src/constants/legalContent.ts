/**
 * Legal pages. Reviewed/owned by Fusiey (Shanghai Worldangle Technology).
 * Have a solicitor review before launch if you want belt-and-braces cover,
 * but these are written to protect the company while staying fair to buyers.
 */

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const COMPANY = 'Shanghai Worldangle Technology Co., Ltd. (上海世角科技有限公司), trading as "Fusiey"';
const CONTACT = 'fusiey@worldangle.work';
const UPDATED = 'Last updated: 12 June 2026';

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    updated: UPDATED,
    intro: `This policy explains what personal data ${COMPANY} ("we", "us", "Fusiey") collects through fusiey.com, how we use it and your rights. The data controller is ${COMPANY}. By using the site you consent to this policy.`,
    sections: [
      { heading: 'What we collect', body: 'Account details (name, email), order and shipping information, saved bead patterns, and basic usage data (device type, pages visited). We never store full payment card numbers — all payments are processed by PayPal.' },
      { heading: 'How we use it', body: 'To create and manage your account, process, ship and support your orders, run the designer and saved works, prevent fraud and abuse, comply with our legal obligations, and (only if you opt in) send you updates.' },
      { heading: 'Lawful basis', body: 'We process data to perform our contract with you (orders/accounts), for our legitimate interests (security, improving the service), to meet legal obligations, and on consent where required (e.g. marketing).' },
      { heading: 'Third parties', body: 'We share data only as needed to operate: PayPal (payments), our hosting and infrastructure providers, shipping/logistics partners, and Google (only if you choose Google sign-in). We do not sell your personal data.' },
      { heading: 'International transfers', body: 'We operate from China and serve customers internationally, so your data may be processed in China and other countries. Where required we apply appropriate safeguards for cross-border transfers.' },
      { heading: 'Cookies', body: 'We use strictly necessary cookies to keep you signed in (httpOnly auth cookies) and remember your cart. We do not use third-party advertising cookies.' },
      { heading: 'Data retention', body: 'We keep account and order data while your account is active and as long as needed for legal, accounting and dispute-resolution purposes, then delete or anonymise it.' },
      { heading: 'Your rights', body: `Subject to applicable law you may access, correct, export, restrict or delete your data and withdraw consent. Email ${CONTACT} and we will respond within a reasonable time.` },
      { heading: 'Contact', body: `Privacy questions or requests: ${CONTACT}.` },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    updated: UPDATED,
    intro: `These Terms are a binding agreement between you and ${COMPANY} governing your use of fusiey.com and any purchase. By using the site, creating an account or placing an order you accept these Terms. If you do not agree, do not use the site.`,
    sections: [
      { heading: 'Eligibility & accounts', body: 'You must be able to form a binding contract and provide accurate information. You are responsible for keeping your login secure and for all activity under your account. We may suspend or close accounts that breach these Terms or are used unlawfully.' },
      { heading: 'Orders, pricing & acceptance', body: 'Prices are shown in GBP and include VAT where applicable; amounts displayed in other currencies are indicative and you are charged in GBP. A contract forms only when we confirm dispatch. We may refuse, limit or cancel any order — including for pricing or stock errors, suspected fraud, or breach of these Terms — and will refund any sum already paid for a cancelled order.' },
      { heading: 'Intellectual property', body: 'The Fusiey name, logos, site design, software, official patterns, images and all related content are owned by or licensed to us and are protected by copyright, trademark and other laws. You may not copy, reproduce, resell, distribute, modify, reverse-engineer or create derivative works from any of it without our prior written permission. Official/purchased patterns are licensed for your personal, non-commercial use only and may not be shared or resold.' },
      { heading: 'Your content & licence to us', body: 'Patterns you create remain yours. By saving or uploading content you confirm you have the right to do so and that it does not infringe any third-party rights or law. You grant us a non-exclusive, worldwide, royalty-free licence to host, store, display and process that content solely to provide the service. You must not upload anything unlawful, infringing, offensive or that contains malware.' },
      { heading: 'Copyright & IP infringement (takedown)', body: `We respect intellectual property and expect users to do the same. If you believe content on Fusiey infringes your copyright or other IP rights, email ${CONTACT} with: (1) identification of the work, (2) the URL/location of the infringing material, (3) your contact details, and (4) a statement that you have a good-faith belief the use is unauthorised. On a valid notice we will promptly remove or disable the material. We act in good faith to protect rights-holders and will not abuse this process; repeat infringers' accounts may be terminated.` },
      { heading: 'Prohibited use', body: 'You must not misuse the site: no scraping, automated access without permission, attempts to breach security, interference with other users, infringement of IP, or use for any unlawful purpose.' },
      { heading: 'Disclaimers & limitation of liability', body: 'The service is provided "as is" and "as available" without warranties of any kind to the fullest extent permitted by law. To the maximum extent permitted by law, we are not liable for any indirect, incidental, special or consequential loss, loss of profit, data or goodwill; and our total liability arising out of or relating to the service or any order is limited to the amount you paid for the relevant order. Nothing in these Terms excludes liability that cannot be excluded under applicable law, including your statutory consumer rights.' },
      { heading: 'Indemnity', body: 'You agree to indemnify and hold us harmless from claims, losses and costs arising out of your breach of these Terms, your content, or your unlawful use of the site.' },
      { heading: 'Changes', body: 'We may update these Terms from time to time; the "last updated" date shows the current version. Continued use after changes means you accept them.' },
      { heading: 'Governing law', body: 'These Terms and any dispute are governed by the laws of the People\'s Republic of China, without prejudice to mandatory consumer-protection rights you may have in your country of residence. Where you are a UK consumer, your statutory rights are unaffected.' },
      { heading: 'Contact', body: `Questions about these Terms: ${CONTACT}.` },
    ],
  },
  {
    slug: 'refunds',
    title: 'Refunds & Returns',
    updated: UPDATED,
    intro: 'We want you to love your beads. This policy covers cancellations, returns and refunds, alongside your statutory rights.',
    sections: [
      { heading: 'Right to cancel', body: 'If you are a consumer you may cancel an order for physical goods within 14 days of receiving them and return unused items for a refund. Digital products (e.g. downloadable patterns) and personalised/custom-made items are exempt once download or production has begun, to the extent permitted by law.' },
      { heading: 'How to return', body: `Email ${CONTACT} with your order number to start a return. Items must be unused and in their original packaging. Unless the item is faulty or wrong, return postage is the customer's responsibility, and we recommend a tracked service.` },
      { heading: 'Refunds', body: 'Once we receive and inspect your return we refund the item price (and, for a full-order return, the original standard delivery cost) to your original payment method, normally within 14 days of receiving the goods.' },
      { heading: 'Faulty, damaged or wrong items', body: `If an item arrives faulty, damaged or incorrect, contact us within 30 days at ${CONTACT} with photos. We will arrange a replacement or full refund including postage.` },
      { heading: 'Non-returnable items', body: 'Downloadable digital patterns and opened/used consumables cannot be returned unless faulty. This does not affect your statutory rights.' },
    ],
  },
  {
    slug: 'shipping',
    title: 'Shipping & Delivery',
    updated: UPDATED,
    intro: 'How and when your order reaches you.',
    sections: [
      { heading: 'Where we ship', body: 'We ship internationally, including the United Kingdom. Orders are dispatched from China.' },
      { heading: 'Delivery times', body: 'Orders typically arrive within 5–12 working days after dispatch. Delivery can take longer due to customs clearance, carrier delays, remote destinations or peak periods. Estimated times are not guaranteed.' },
      { heading: 'Customs & duties', body: 'As orders ship from China, your local customs may apply import duties or taxes on delivery, which are the recipient\'s responsibility. Please check your country\'s rules before ordering.' },
      { heading: 'Costs', body: 'Standard delivery is £4.99. Orders over £50 ship free. Any applicable customs charges are separate (see above).' },
      { heading: 'Tracking', body: 'You can follow your order under My Orders. Once your parcel ships, the carrier, tracking number and tracking link (where available) appear on your order so you can follow it to your door.' },
      { heading: 'Digital products', body: 'Downloadable patterns are delivered electronically and are available immediately after purchase — no shipping required.' },
    ],
  },
];

export const LEGAL_BY_SLUG = Object.fromEntries(LEGAL_DOCS.map((d) => [d.slug, d]));
