import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "vitest";

const program = `
import importlib.util,json,subprocess,sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('guard',sys.argv[1])
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
kind=sys.argv[2];state=g.expected();transactions=[]
network={'Name':g.NETWORK,'Driver':'bridge','Scope':'local','EnableIPv6':False,'Internal':False,
 'Labels':{'com.oioi.waveform.network':'1'},'Options':{'com.docker.network.bridge.name':g.BRIDGE,'com.docker.network.bridge.enable_icc':'false'}}
if kind=='priority':state[1]['chain']['prio']=0
if kind=='source':state[3]['rule']['expr'][0]['match']['right']='other'
if kind=='verdict':state[3]['rule']['expr'][-1]={'accept':None}
if kind=='extra':state.append(state[-1])
if kind=='missing':state.pop()
if kind=='counter':state[3]['rule']['expr'][1]['counter']['packets']='0'
if kind=='ipv6':network['EnableIPv6']=True
if kind=='internal':network['Internal']=True
if kind=='driver':network['Driver']='host'
if kind=='scope':network['Scope']='swarm'
if kind=='bridge':network['Options']['com.docker.network.bridge.name']='other'
if kind=='icc':network['Options']['com.docker.network.bridge.enable_icc']='true'
if kind=='label':network['Labels']={}
if kind=='null-label':network['Labels']=None
for item in state:
 for body in item.values():body['handle']=1

def command(args,data=None):
 if kind=='tool-error':raise subprocess.CalledProcessError(1,args,stderr='private-response')
 if args[0]=='docker':return json.dumps([network])
 if '-f' in args:transactions.append(json.loads(data));return ''
 return json.dumps({'nftables':[{'metainfo':{'version':'fixture'}},*state]})
g.command=command
sys.argv=['guard','apply' if kind=='apply' else 'check']
status=g.main()
if kind=='apply' and status==0:print(json.dumps(transactions))
sys.exit(status)
`;
function execute(kind: string) {
  return spawnSync(
    "python3",
    ["-I", "-c", program, resolve("ops/oci/waveform-egress-guard.py"), kind],
    {
      encoding: "utf8",
      timeout: 5000,
    },
  );
}

test("전용 table만 원자적으로 교체하며 같은 transaction을 먼저 검사한다", () => {
  const result = execute("apply");
  expect(result.status, result.stderr).toBe(0);
  const transactions = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
  expect(transactions).toHaveLength(2);
  expect(transactions[0]).toEqual(transactions[1]);
  expect(JSON.stringify(transactions)).not.toContain("oioi_metadata_guard");
  expect(JSON.stringify(transactions)).not.toContain("flush");
  expect(transactions[0].nftables[1]).toEqual({
    delete: { table: { family: "inet", name: "oioi_waveform_guard" } },
  });
});

test("정상 bridge와 규칙은 통과한다", () => {
  const result = execute("valid");
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toBe('{"event":"waveform_egress_guard_passed"}\n');
});

test.each([
  "priority",
  "source",
  "verdict",
  "extra",
  "missing",
  "counter",
  "ipv6",
  "internal",
  "driver",
  "scope",
  "bridge",
  "icc",
  "label",
  "null-label",
  "tool-error",
])("%s 불일치와 내부 진단은 성공·로그 원문으로 노출하지 않는다", (kind) => {
  const result = execute(kind);
  expect(result.status).toBe(1);
  expect(result.stderr).toBe('{"event":"waveform_egress_guard_failed"}\n');
  expect(result.stdout).toBe("");
});
