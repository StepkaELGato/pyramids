import "./About.css";

export default function About() {
  return (
    <div className="aboutPage">
      <section className="aboutHero container">
        <div className="aboutHero__badge">Pyramids Computer Club</div>

        <h1 className="aboutHero__title">Общая информация</h1>

        <p className="aboutHero__text">
          Pyramids — это сеть компьютерных клубов, где можно поиграть с комфортом,
          собрать команду, устроить тренировку или просто отлично провести время.
          Мы стараемся сделать атмосферу “как дома”, но с техникой уровня турниров.
        </p>

        <div className="aboutHero__stats">
          <div className="aboutStat">
            <div className="aboutStat__num">PC • Console • VR</div>
            <div className="aboutStat__label">игровые зоны</div>
          </div>
          <div className="aboutStat">
            <div className="aboutStat__num">Турниры</div>
            <div className="aboutStat__label">регулярные события</div>
          </div>
          <div className="aboutStat">
            <div className="aboutStat__num">VIP</div>
            <div className="aboutStat__label">комнаты для компаний</div>
          </div>
        </div>
      </section>

      <section className="aboutGrid container">
        <article className="aboutCard">
          <h2 className="aboutCard__title">Большой ассортимент</h2>
          <p className="aboutCard__text">
            Игровые ПК, консоли и VR — выбирай формат под настроение.
            Можно прийти одному, с друзьями или собрать команду для катки.
          </p>
          <ul className="aboutList">
            <li>Компьютеры для популярных онлайн-игр</li>
            <li>Консольная зона для отдыха</li>
            <li>VR для новых впечатлений</li>
          </ul>
        </article>

        <article className="aboutCard">
          <h2 className="aboutCard__title">Турниры и командная игра</h2>
          <p className="aboutCard__text">
            Мы любим соревновательный дух: проводим турниры, анонсы и активности.
            Можно участвовать, болеть за друзей или просто смотреть, как играют сильнейшие.
          </p>
          <ul className="aboutList">
            <li>Турниры для разных уровней</li>
            <li>Команды и регистрация участников</li>
            <li>Призы и рейтинг</li>
          </ul>
        </article>

        <article className="aboutCard">
          <h2 className="aboutCard__title">Комфорт и атмосфера</h2>
          <p className="aboutCard__text">
            Pyramids — это не только про игры, но и про комфорт: удобные места,
            понятное бронирование и дружелюбная атмосфера.
          </p>
          <ul className="aboutList">
            <li>VIP-комнаты для компании</li>
            <li>Поддержка администратора</li>
            <li>Можно прийти “просто потусить”</li>
          </ul>
        </article>
      </section>

      <section className="aboutQuote container">
        <div className="aboutQuote__inner">
          <p className="aboutQuote__text">
            «В стране пирамид всё решает стратегия: в древности — на поле битвы,
            сегодня — в игре. Подними свой уровень в Pyramids.»
          </p>
          <div className="aboutQuote__sub">
            Играй. Побеждай. Оставь свой след, как фараоны.
          </div>
        </div>
      </section>
    </div>
  );
}