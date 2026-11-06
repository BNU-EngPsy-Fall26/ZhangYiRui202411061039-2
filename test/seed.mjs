// 被试编号推算：只认 P + 数字，其他格式必须被忽略
const { nextParticipant } = await import('../js/lib/upload.js');

const out = [];
const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
const rec = (...p) => p.map((x) => ({ participant: x }));

ok(nextParticipant([]) === 'P01', '空记录 → P01');
ok(nextParticipant(null) === 'P01', 'null → P01');
ok(nextParticipant(rec('P01', 'P02', 'P03', 'P04', 'P05')) === 'P06', 'P01–P05 → P06');
ok(nextParticipant(rec('P01', 'P05', 'P03')) === 'P06', '乱序也取最大值 +1');
ok(nextParticipant(rec('P03', 'P03')) === 'P04', '重复编号不重复计数（P03 两次 → P04）');

// 非规范编号一律忽略
ok(nextParticipant(rec('test004')) === 'P01', 'ignores test004');
ok(nextParticipant(rec('test004', 'P02')) === 'P03', 'test004 不参与最大值计算');
ok(nextParticipant(rec('anonymous', 'P01')) === 'P02', 'ignores anonymous');
ok(nextParticipant(rec('', '  ', 'P01')) === 'P02', 'ignores 空串与空白');
ok(nextParticipant(rec('P', 'P0x', 'P1A', 'P-1')) === 'P01', 'ignores P / P0x / P1A / P-1');
ok(nextParticipant(rec('S01', 'XP02', 'P02 ', 'P02X')) === 'P03', '只认完整匹配（后面多字符不算）');

// 补零与小写
ok(nextParticipant(rec('P3')) === 'P04', 'P3 → P04（补到两位）');
ok(nextParticipant(rec('p07')) === 'P08', '小写 p07 → P08');
ok(nextParticipant(rec('P99')) === 'P100', 'P99 → P100（三位不截断）');
ok(nextParticipant(rec('P100')) === 'P101', 'P100 → P101');

// 前后空格应被容忍
ok(nextParticipant(rec(' P06 ')) === 'P07', '容忍首尾空格');
ok(nextParticipant([{ participant: undefined }, { participant: 123 }, { participant: 'P04' }]) === 'P05', '非字符串不影响结果');

console.log(out.join('\n'));
const fail = out.filter((s) => s.startsWith('FAIL')).length;
console.log('\n' + (fail ? fail + ' 项失败' : '全部通过'));
process.exit(fail ? 1 : 0);
