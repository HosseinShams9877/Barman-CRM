// محاسبه تاریخ شمسی امروز با الگوریتم JDF (بدون وابستگی — صرفاً بررسی مستقل)
function div(a, b) { return Math.trunc(a / b); }
function jalaliToJdn(jy, jm, jd) {
  const epbase = jy - (jm > 6 ? 477 : 478);
  return div(epbase, 2820) * 2820 + 1029983 + 365 * (jy - div(epbase, 2820) * 2820) + div(jy - div(epbase, 2820) * 2820 + (jm > 6 ? 3 : 0), 4) + 31 * jm - div(jm + 1, 2) + jd;
}
function jdnToJalali(jdn) {
  const depoch = jdn - jalaliToJdn(475, 1, 1);
  const cycle = div(depoch, 1029983);
  const cyear = depoch % 1029983;
  let ycycle, aux1, aux2;
  if (cyear === 1029982) ycycle = 2820;
  else { aux1 = div(cyear, 366); aux2 = cyear % 366; ycycle = div(2134 * aux1 + 2816 * aux2 + 2815, 1028522) + aux1 + 1; }
  let jy = ycycle + 2820 * cycle + 474;
  if (jy <= 0) jy -= 1;
  const yday = jdn - jalaliToJdn(jy, 1, 1) + 1;
  const jm = yday <= 186 ? div(yday + 28, 31) : div(yday - 186, 30) + 6;
  const jd = yday <= 186 ? yday - 31 * (jm - 1) : yday - 186 - 30 * (jm - 7);
  return { jy, jm, jd };
}
const now = new Date();
const jdn = div(now.getTime(), 86400000) + 2440588;
const { jy, jm, jd } = jdnToJalali(jdn);
console.log(`today: ${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`);
console.log("iso+10d check:", jdnToJalali(jdn + 10));
