import { useEffect, useRef, useState } from "preact/hooks";
import { useKeys } from "../../nav/back";
import { digitOf, navKey } from "../../nav/keys";

const COMMIT_MS = 1600;
const MAX_DIGITS = 4;

/**
 * Teclear un número de canal con los dígitos del control: se muestra mientras se escribe y se
 * confirma solo tras una pausa (o con OK).
 */
export function useNumberEntry(onCommit: (n: number) => void, active: boolean): string {
  const [digits, setDigits] = useState("");
  const timer = useRef(0);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const value = useRef("");

  const finish = () => {
    clearTimeout(timer.current);
    const n = parseInt(value.current, 10);
    value.current = "";
    setDigits("");
    if (n > 0) commit.current(n);
  };

  useKeys((e) => {
    const k = navKey(e);
    if (k === "digit") {
      e.preventDefault();
      value.current = (value.current + digitOf(e)).slice(-MAX_DIGITS);
      setDigits(value.current);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(finish, COMMIT_MS);
    } else if (k === "ok" && value.current) {
      e.preventDefault();
      finish();
    } else if (k === "back" && value.current) {
      e.preventDefault();
      clearTimeout(timer.current);
      value.current = "";
      setDigits("");
    }
  }, active);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return digits;
}
