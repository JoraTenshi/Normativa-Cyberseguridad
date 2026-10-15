import {buildHistoryReport} from '../public-experience/demo/task-history';
import {createWorkspace} from '../public-experience/demo/workspace-model';

const originalClone=global.structuredClone;
beforeAll(()=>{if(!global.structuredClone)global.structuredClone=value=>require('v8').deserialize(require('v8').serialize(value));});
afterAll(()=>{if(originalClone)global.structuredClone=originalClone;else delete global.structuredClone;});

test('downloaded report is escaped, static, standalone and explicitly fictional',()=>{
  const data=createWorkspace();
  data.profile.legalName='<script>window.bad=1</script><img src=x onerror=alert(1)>';
  const {html,filename}=buildHistoryReport(data,'saas',{generatedAt:'2026-10-15T10:00:00Z'});
  expect(filename).toMatch(/\.html$/);
  expect(html).toContain("default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  expect(html).not.toMatch(/<script[\s>]|<iframe[\s>]|<link[\s>]|<img[\s>]|<form[\s>]/i);
  expect(html).toContain('&lt;script&gt;');expect(html).toContain('datos ficticios');
  expect(html).toContain('sin conexión con el servidor');
});
