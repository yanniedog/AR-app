import { responsiveScreenContentStyle } from '../src/components/Screen';

describe('responsive screen measure', () => {
  it('keeps compact gutters on phones and centres bounded content on wide screens', () => {
    expect(responsiveScreenContentStyle(390)).toMatchObject({
      width: '100%',
      maxWidth: 712,
      alignSelf: 'center',
      paddingHorizontal: 16,
    });
    expect(responsiveScreenContentStyle(1_200, 'data')).toMatchObject({
      width: '100%',
      maxWidth: 968,
      alignSelf: 'center',
      paddingHorizontal: 24,
    });
  });

  it('allows deliberately full-width canvases', () => {
    expect(responsiveScreenContentStyle(1_200, 'full').maxWidth).toBeUndefined();
  });
});
