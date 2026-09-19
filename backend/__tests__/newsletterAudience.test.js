process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test_dummy';

const { sanitizeAudience, describeAudience, personalizeSubject, personalizeHtml, toHtmlBody } =
  await import('../services/newsletterService.js');
const { buildDigest } = await import('../services/newsletterDigestService.js');

describe('sanitizeAudience', () => {
  test('defaults to subscribers and ignores merchant filters for them', () => {
    expect(sanitizeAudience(undefined)).toEqual({ source: 'subscribers', activity: 'all', businessType: '', county: '' });
    expect(sanitizeAudience({ source: 'subscribers', county: 'Nairobi', activity: 'dormant' }))
      .toEqual({ source: 'subscribers', activity: 'all', businessType: '', county: '' });
  });

  test('keeps merchant filters, rejects unknown activity, clamps length', () => {
    const a = sanitizeAudience({ source: 'merchants', activity: 'weird', county: '  Nairobi  ', businessType: 'x'.repeat(200) });
    expect(a.source).toBe('merchants');
    expect(a.activity).toBe('all');
    expect(a.county).toBe('Nairobi');
    expect(a.businessType).toHaveLength(60);
  });

  test('describeAudience is human readable', () => {
    expect(describeAudience(undefined)).toBe('Newsletter subscribers');
    expect(describeAudience({ source: 'merchants', activity: 'dormant', county: 'Kisumu' })).toBe('Merchants · dormant · Kisumu');
  });
});

describe('merge tags and body conversion', () => {
  test('{{name}} falls back to "there" and body values are HTML-escaped', () => {
    expect(personalizeSubject('Hi {{ Name }}', '')).toBe('Hi there');
    expect(personalizeHtml('<p>Hi {{name}}</p>', '<b>Eve</b>')).toBe('<p>Hi &lt;b&gt;Eve&lt;/b&gt;</p>');
  });

  test('plain text becomes escaped paragraphs; html passes through', () => {
    expect(toHtmlBody('a & b\n\nsecond', false)).toContain('a &amp; b');
    expect(toHtmlBody('<p>x</p>', true)).toBe('<p>x</p>');
  });
});

describe('buildDigest', () => {
  const post = (over = {}) => ({ title: 'Big News', slug: 'big-news', excerpt: 'Short.', category: 'Product Updates', image: '', ...over });

  test('single post: subject names it, links to the marketing site', () => {
    const d = buildDigest([post()]);
    expect(d.subject).toBe('New on PayChain: Big News');
    expect(d.html).toContain('https://www.paychain.co.ke/blog/big-news');
    expect(d.html).toContain('{{name}}');
  });

  test('several posts: generic subject, one card each', () => {
    const d = buildDigest([post(), post({ title: 'Two', slug: 'two' })]);
    expect(d.subject).toBe("What's new at PayChain");
    expect(d.html.match(/Read more/g)).toHaveLength(2);
  });

  test('post fields are escaped so content can never inject markup', () => {
    const d = buildDigest([post({ title: '<script>x</script>', excerpt: '"q" & <i>', slug: 'a b' })]);
    expect(d.html).not.toContain('<script>');
    expect(d.html).toContain('&lt;script&gt;');
    expect(d.html).toContain('/blog/a%20b');
  });
});
