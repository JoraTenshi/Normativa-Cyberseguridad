import React from 'react';
import {render,screen,act} from '@testing-library/react';
import useTaskArrival from './useTaskArrival';

function Target({id='a',request=1,ready=true}){const arrival=useTaskArrival(id,request,ready);return <header ref={arrival.target} tabIndex={-1} data-testid="target" data-task-arrival={String(arrival.active)}>{id}</header>;}
beforeEach(()=>{
  jest.useFakeTimers();window.matchMedia=jest.fn(()=>({matches:false}));
  window.requestAnimationFrame=callback=>setTimeout(callback,0);window.cancelAnimationFrame=clearTimeout;
  Element.prototype.scrollIntoView=jest.fn();
  jest.spyOn(Element.prototype,'getBoundingClientRect').mockReturnValue({top:1000,bottom:1100});
});
afterEach(()=>{jest.clearAllTimers();jest.useRealTimers();jest.restoreAllMocks();});
test('waits for exact loaded target, focuses once without jump and scrolls smoothly',()=>{
  const view=render(<Target ready={false}/>);act(()=>jest.advanceTimersByTime(0));expect(document.activeElement).not.toBe(screen.getByTestId('target'));
  view.rerender(<Target/>);act(()=>jest.advanceTimersByTime(0));expect(document.activeElement).toBe(screen.getByTestId('target'));expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({block:'center',behavior:'smooth'});expect(screen.getByTestId('target').dataset.taskArrival).toBe('true');
  act(()=>jest.advanceTimersByTime(2800));expect(screen.getByTestId('target').dataset.taskArrival).toBe('false');
});
test('reduced motion uses immediate movement; static style is supplied by CSS',()=>{
  window.matchMedia.mockReturnValue({matches:true});render(<Target/>);act(()=>jest.advanceTimersByTime(0));expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({block:'center',behavior:'instant'});
});
test('visible target receives focus and halo without scrolling',()=>{
  Element.prototype.getBoundingClientRect.mockReturnValue({top:120,bottom:220});render(<Target/>);act(()=>jest.advanceTimersByTime(0));expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();expect(document.activeElement).toBe(screen.getByTestId('target'));
});
test('same target can be deliberately highlighted again',()=>{
  const view=render(<Target/>);act(()=>jest.advanceTimersByTime(2801));view.rerender(<Target request={2}/>);act(()=>jest.advanceTimersByTime(0));expect(screen.getByTestId('target').dataset.taskArrival).toBe('true');
});
test('unmount before loading or animation cancels pending focus',()=>{
  const view=render(<Target/>);view.unmount();act(()=>jest.runAllTimers());expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
});
test('reveals a header clipped inside an independently scrolling detail panel',()=>{
  render(<aside data-testid="panel" style={{overflowY:'auto'}}><Target/></aside>);
  const panel=screen.getByTestId('panel'),target=screen.getByTestId('target');
  Object.defineProperties(panel,{scrollHeight:{value:1200},clientHeight:{value:570},scrollTop:{value:147,writable:true}});
  panel.scrollTo=jest.fn();panel.getBoundingClientRect=()=>({top:600,bottom:1170});target.getBoundingClientRect=()=>({top:453,bottom:638});
  act(()=>jest.advanceTimersByTime(0));
  expect(panel.scrollTo).toHaveBeenCalledWith({top:0,behavior:'smooth'});expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({block:'start',behavior:'smooth'});expect(Element.prototype.scrollIntoView.mock.instances[0]).toBe(panel);
});
