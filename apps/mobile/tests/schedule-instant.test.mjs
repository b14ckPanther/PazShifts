import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleInstant } from './schedule-instant-loader.mjs';
const convert = scheduleInstant.scheduledWallTimeToInstant;
const zone = 'Asia/Jerusalem';
test('published Friday evening and Saturday morning preserve admin station clock times', () => {
  for (const [date, start, end, utcStart, utcEnd] of [
    ['2026-09-18', '14:00', '22:00', '11:00', '19:00'],
    ['2026-09-19', '06:00', '14:00', '03:00', '11:00'],
  ]) {
    assert.equal(convert(`${date}T${start}:00+00:00`, zone), `${date}T${utcStart}:00.000Z`);
    assert.equal(convert(`${date}T${end}:00Z`, zone), `${date}T${utcEnd}:00.000Z`);
  }
});
test('overnight dates and winter offset are preserved without hardcoded three-hour subtraction', () => {
  assert.equal(convert('2026-09-18T22:00:00Z', zone), '2026-09-18T19:00:00.000Z');
  assert.equal(convert('2026-09-19T06:00:00Z', zone), '2026-09-19T03:00:00.000Z');
  assert.equal(convert('2026-12-18T14:00:00Z', zone), '2026-12-18T12:00:00.000Z');
  assert.equal(convert('2026-09-18T14:00:00Z', 'UTC'), '2026-09-18T14:00:00.000Z');
});
test('DST crossing uses each endpoint offset and rejects impossible clock hours', () => {
  const start = convert('2026-03-26T22:00:00Z', zone);
  const end = convert('2026-03-27T06:00:00Z', zone);
  assert.equal((Date.parse(end) - Date.parse(start)) / 3600000, 7);
  assert.throws(() => convert('2026-03-27T02:30:00Z', zone));
  assert.throws(() => convert('invalid', zone));
});

test('fall overlap matches notification SQL earlier-instant policy and winter overnight length', () => {
  assert.equal(convert('2026-10-25T01:30:00Z', zone), '2026-10-24T22:30:00.000Z');
  assert.equal(
    (Date.parse(convert('2026-10-25T06:00Z', zone)) -
      Date.parse(convert('2026-10-24T22:00Z', zone))) /
      3600000,
    9
  );
});
test('station timezone, negative and fractional offsets, and fractional seconds are preserved', () => {
  assert.equal(convert('2026-09-18T14:00:00Z', 'America/New_York'), '2026-09-18T18:00:00.000Z');
  assert.equal(convert('2026-09-18T14:00:00Z', 'Asia/Kolkata'), '2026-09-18T08:30:00.000Z');
  assert.equal(convert('2026-09-18T14:00:00.123Z', zone), '2026-09-18T11:00:00.123Z');
  assert.equal(convert('2026-09-18T17:00:00+03:00', zone), '2026-09-18T11:00:00.000Z');
  assert.throws(() => convert('2026-09-18T14:00Z', 'Invalid/Zone'));
});
