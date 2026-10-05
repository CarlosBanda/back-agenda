import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns a healthy status', () => {
    const controller = new AppController();
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
