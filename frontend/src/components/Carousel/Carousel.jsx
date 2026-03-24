import { useEffect, useMemo, useRef, useState } from "react";
import "./Carousel.css";

export default function Carousel({
  slides = [],
  renderSlide,
  ariaLabel = "Карусель",
  autoplayMs = 0,
}) {
  const n = slides.length;

  // [last, ...slides, first]
  const extended = useMemo(() => {
    if (!n) return [];
    return [slides[n - 1], ...slides, slides[0]];
  }, [slides, n]);

  const [index, setIndex] = useState(n ? 1 : 0); // индекс в extended
  const [transitionOn, setTransitionOn] = useState(true);

  // refs для стабильности при быстрых кликах и чтобы не ловить "устаревшие" значения
  const indexRef = useRef(index);
  const lockRef = useRef(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // если количество слайдов поменялось — сброс
  useEffect(() => {
    setTransitionOn(true);
    setIndex(n ? 1 : 0);
    lockRef.current = false;
  }, [n]);

  const realIndex = useMemo(() => {
    if (!n) return 0;
    if (index === 0) return n - 1;
    if (index === n + 1) return 0;
    return index - 1;
  }, [index, n]);

  const next = () => {
    if (!n) return;
    if (lockRef.current) return; // защита от спама кликов
    lockRef.current = true;
    setTransitionOn(true);
    setIndex((i) => i + 1);
  };

  const prev = () => {
    if (!n) return;
    if (lockRef.current) return;
    lockRef.current = true;
    setTransitionOn(true);
    setIndex((i) => i - 1);
  };

  const goTo = (ri) => {
    if (!n) return;
    if (lockRef.current) return;
    lockRef.current = true;
    setTransitionOn(true);
    setIndex(ri + 1);
  };

  // автопрокрутка (если включишь)
  useEffect(() => {
    if (!autoplayMs || autoplayMs < 1500 || n < 2) return;
    const id = setInterval(() => {
      // не крутим, если пользователь сейчас кликает/идёт анимация
      if (!lockRef.current) next();
    }, autoplayMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayMs, n]);

  const onTransitionEnd = (e) => {
    // иногда transitionend может прилететь с другого свойства — фильтруем
    if (e?.propertyName && e.propertyName !== "transform") return;

    if (!n) return;

    const i = indexRef.current;

    // дошли до клона -> прыжок без анимации
    if (i === 0) {
      setTransitionOn(false);
      setIndex(n);
      // unlock после "прыжка" и следующего кадра
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionOn(true);
          lockRef.current = false;
        });
      });
      return;
    }

    if (i === n + 1) {
      setTransitionOn(false);
      setIndex(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionOn(true);
          lockRef.current = false;
        });
      });
      return;
    }

    // обычное завершение анимации
    lockRef.current = false;
  };

  if (!n) return null;

  return (
    <section className="carousel" aria-label={ariaLabel}>
      <div className="carousel__frame">
        <button
          type="button"
          className="carousel__arrow carousel__arrow--left"
          onClick={prev}
          aria-label="Предыдущий слайд"
        >
          ‹
        </button>

        <div className="carousel__window">
          <div
            className="carousel__track"
            style={{
              transform: `translateX(-${index * 100}%)`,
              transition: transitionOn ? "transform 500ms ease" : "none",
            }}
            onTransitionEnd={onTransitionEnd}
          >
            {extended.map((s, i) => (
              <div className="carousel__slide" key={`${s?.id ?? "slide"}-${i}`}>
                {renderSlide(s, realIndex)}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="carousel__arrow carousel__arrow--right"
          onClick={next}
          aria-label="Следующий слайд"
        >
          ›
        </button>

        <div className="carousel__dots" aria-label="Индикатор слайдов">
          {slides.map((s, i) => (
            <button
              key={s?.id ?? i}
              type="button"
              className={
                i === realIndex
                  ? "carousel__dot carousel__dot--active"
                  : "carousel__dot"
              }
              onClick={() => goTo(i)}
              aria-label={`Слайд ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}