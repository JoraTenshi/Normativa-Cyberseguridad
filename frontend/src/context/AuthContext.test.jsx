import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { createSessionMachine } from '../session/session-machine';
jest.mock('../session/session-machine', () => ({ createSessionMachine:jest.fn() }));
jest.mock('../session/session-bridge', () => ({bindSession:() => () => {}}));
jest.mock('../session/transport', () => ({sessionTransport:{}}));
let instances, machine;
const original = global.BroadcastChannel;
beforeEach(() => {
  instances = new Set();
  global.BroadcastChannel = class {
    constructor(name) { this.name=name; instances.add(this); }
    postMessage(data) { for (const peer of instances) if (peer !== this && peer.name === this.name) peer.onmessage?.({data}); }
    close() { instances.delete(this); }
  };
  const state={phase:'anonymous',user:null};
  createSessionMachine.mockImplementation((transport,{publish}) => {
    machine={subscribe:() => () => {},getSnapshot:() => state,sync:jest.fn(),tick:jest.fn(),activity:jest.fn(),lock:jest.fn(),signedIn:() => publish('session-changed'),logout:() => publish('signed-out')};
    return machine;
  });
});
afterEach(() => { global.BroadcastChannel=original; });
function Buttons() { const auth=useAuth(); return <><button onClick={auth.login}>Entrar</button><button onClick={auth.logout}>Salir</button></>; }
test('own sign-in and sign-out do not lock their own provider', () => {
  const view=render(<AuthProvider><Buttons/></AuthProvider>);
  fireEvent.click(screen.getByText('Entrar')); fireEvent.click(screen.getByText('Salir'));
  expect(machine.lock).not.toHaveBeenCalled();
  expect(instances.size).toBe(1);
  view.unmount(); expect(instances.size).toBe(0);
});
test('another tab still locks and revalidates session changes, without revalidating sign-out', () => {
  render(<AuthProvider><Buttons/></AuthProvider>);
  const other=new BroadcastChannel('normativacheck-session');
  machine.sync.mockClear();
  act(() => other.postMessage({type:'session-changed'}));
  expect(machine.lock).toHaveBeenCalledWith('La sesión ha cambiado en otra pestaña.');
  expect(machine.sync).toHaveBeenCalledTimes(1);
  act(() => other.postMessage({type:'signed-out'}));
  expect(machine.lock).toHaveBeenCalledTimes(2);
  expect(machine.sync).toHaveBeenCalledTimes(1);
  other.close();
});
