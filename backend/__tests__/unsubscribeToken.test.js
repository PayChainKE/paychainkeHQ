process.env.JWT_SECRET = 'test-secret-for-unsubscribe';

const { makeUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } = await import('../utils/unsubscribeToken.js');

const ID = '64b7f0a1c2d3e4f5a6b7c8d9';

describe('unsubscribe tokens', () => {
  test('round-trips both kinds', () => {
    expect(verifyUnsubscribeToken(makeUnsubscribeToken('s', ID))).toEqual({ kind: 's', id: ID });
    expect(verifyUnsubscribeToken(makeUnsubscribeToken('m', ID))).toEqual({ kind: 'm', id: ID });
  });

  test('a tampered id, kind or signature is rejected', () => {
    const t = makeUnsubscribeToken('s', ID);
    expect(verifyUnsubscribeToken(t.replace(ID, '64b7f0a1c2d3e4f5a6b7c8da'))).toBeNull();
    expect(verifyUnsubscribeToken(t.replace(/^s\./, 'm.'))).toBeNull();
    expect(verifyUnsubscribeToken(t.slice(0, -2) + 'xx')).toBeNull();
  });

  test('garbage input is rejected without throwing', () => {
    for (const bad of [undefined, null, '', 'abc', 's.x.y', `s.${ID}`, `x.${ID}.sig`, `s.${ID}.sig.extra`, 42]) {
      expect(verifyUnsubscribeToken(bad)).toBeNull();
    }
  });

  test('a token signed with another secret does not verify', async () => {
    const t = makeUnsubscribeToken('s', ID);
    process.env.JWT_SECRET = 'a-different-secret';
    expect(verifyUnsubscribeToken(t)).toBeNull();
    process.env.JWT_SECRET = 'test-secret-for-unsubscribe';
  });

  test('unsubscribeUrl points at the public API and carries a valid token', () => {
    const url = new URL(unsubscribeUrl('m', ID));
    expect(url.pathname).toBe('/api/newsletter/unsubscribe');
    expect(verifyUnsubscribeToken(url.searchParams.get('t'))).toEqual({ kind: 'm', id: ID });
  });
});
