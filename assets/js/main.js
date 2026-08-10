/* =========================================================================
   МРО 145 АВИАКОМПОНЕНТ — скрипты сайта
   Без зависимостей. Работает и на русской, и на английской версии:
   все подписи берутся из data-атрибутов <html data-i18n-*> или из разметки.
   ========================================================================= */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     КУДА ОТПРАВЛЯТЬ ЗАЯВКИ

     Пока строка пустая, форма проверяет поля и показывает предупреждение,
     но НИКУДА НЕ ОТПРАВЛЯЕТ данные. Так сделано намеренно: молча теряющая
     заявки форма хуже, чем честно выключенная.

     Как включить отправку — см. README.md, раздел «Форма обратной связи».
     Примеры значения:
       "https://formspree.io/f/xxxxxxxx"
       "/send.php"
     ----------------------------------------------------------------------- */
  var FORM_ENDPOINT = "";

  var isRu = (document.documentElement.lang || "ru").indexOf("en") !== 0;

  var T = isRu
    ? {
        required: "Заполните это поле",
        phoneShort: "Введите номер полностью",
        nameShort: "Укажите имя",
        consent: "Нужно согласие на обработку персональных данных",
        sending: "Отправляем…",
        ok: "Заявка отправлена. Наш менеджер перезвонит вам в ближайшее время.",
        err: "Не удалось отправить заявку. Позвоните нам по телефону +7 (915) 479-69-58.",
        noEndpoint:
          "Отправка формы ещё не подключена. Укажите адрес обработчика в assets/js/main.js (константа FORM_ENDPOINT) — инструкция в README.md.",
        menuOpen: "Открыть меню",
        menuClose: "Закрыть меню"
      }
    : {
        required: "Please fill in this field",
        phoneShort: "Enter the full phone number",
        nameShort: "Enter your name",
        consent: "Please agree to the personal data processing policy",
        sending: "Sending…",
        ok: "Request sent. Our manager will call you back shortly.",
        err: "Could not send the request. Please call us at +7 (915) 479-69-58.",
        noEndpoint:
          "Form delivery is not configured yet. Set the handler URL in assets/js/main.js (FORM_ENDPOINT) — see README.md.",
        menuOpen: "Open menu",
        menuClose: "Close menu"
      };

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ---------- 1. Мобильное меню ---------- */

  function initNav() {
    var burger = $(".burger");
    var nav = $("#site-nav");
    var header = $(".site-header");
    if (!burger || !nav || !header) return;

    function setOpen(open) {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? T.menuClose : T.menuOpen);
      nav.classList.toggle("is-open", open);
      header.classList.toggle("is-open", open);
      document.body.classList.toggle("is-locked", open);
    }

    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });

    // Клик по пункту меню закрывает его на мобильных
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        burger.focus();
      }
    });

    // При возврате на десктоп меню не должно остаться «открытым»
    var mq = window.matchMedia("(min-width: 901px)");
    var onChange = function (e) {
      if (e.matches) setOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------- 2. Аккордеон (вопросы и ответы) ---------- */

  function initAccordion() {
    $$(".acc__btn").forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;

      var open = btn.getAttribute("aria-expanded") === "true";
      panel.setAttribute("data-open", String(open));

      btn.addEventListener("click", function () {
        var next = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(next));
        panel.setAttribute("data-open", String(next));
      });
    });
  }

  /* ---------- 3. Поле телефона: маска +7 (XXX) XXX-XX-XX ---------- */

  function formatPhone(raw) {
    var d = raw.replace(/\D/g, "");

    // Приводим 8XXXXXXXXXX и 7XXXXXXXXXX к одному виду
    if (d[0] === "8") d = "7" + d.slice(1);
    if (d[0] !== "7") d = "7" + d;
    d = d.slice(0, 11);

    var out = "+7";
    if (d.length > 1) out += " (" + d.slice(1, 4);
    if (d.length >= 4) out += ")";
    if (d.length > 4) out += " " + d.slice(4, 7);
    if (d.length > 7) out += "-" + d.slice(7, 9);
    if (d.length > 9) out += "-" + d.slice(9, 11);
    return out;
  }

  function initPhoneMask() {
    $$('input[data-mask="phone"]').forEach(function (input) {
      var apply = function () {
        var atEnd = input.selectionStart === input.value.length;
        input.value = formatPhone(input.value);
        if (atEnd) {
          var end = input.value.length;
          input.setSelectionRange(end, end);
        }
      };

      input.addEventListener("focus", function () {
        if (!input.value) input.value = "+7 ";
      });

      input.addEventListener("input", apply);

      input.addEventListener("blur", function () {
        if (input.value.replace(/\D/g, "").length <= 1) input.value = "";
      });
    });
  }

  /* ---------- 4. Форма обратной связи ---------- */

  function setFieldError(field, message) {
    var box = field.closest(".field");
    if (!box) return;
    var err = $(".field__err", box);
    box.classList.toggle("field--invalid", Boolean(message));
    if (err) err.textContent = message || "";
    field.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function validate(form) {
    var ok = true;
    var firstBad = null;

    $$("input, textarea", form).forEach(function (field) {
      if (field.type === "checkbox" || !field.hasAttribute("required")) {
        setFieldError(field, "");
        return;
      }

      var value = field.value.trim();
      var message = "";

      if (!value) {
        message = T.required;
      } else if (field.dataset.mask === "phone") {
        if (value.replace(/\D/g, "").length < 11) message = T.phoneShort;
      } else if (field.name === "name" && value.length < 2) {
        message = T.nameShort;
      }

      setFieldError(field, message);
      if (message) {
        ok = false;
        if (!firstBad) firstBad = field;
      }
    });

    var consent = $('input[type="checkbox"][required]', form);
    if (consent) {
      var label = consent.closest(".consent");
      if (label) label.classList.toggle("is-invalid", !consent.checked);
      if (!consent.checked) {
        ok = false;
        if (!firstBad) firstBad = consent;
      }
    }

    return { ok: ok, firstBad: firstBad, consent: consent };
  }

  function initForms() {
    $$("form[data-callback-form]").forEach(function (form) {
      var status = $(".form-status", form);
      var submit = $('button[type="submit"]', form);

      var say = function (state, text) {
        if (!status) return;
        status.setAttribute("data-state", state);
        status.textContent = text;
      };

      // Убираем подсветку ошибки, как только пользователь начал исправлять
      form.addEventListener("input", function (e) {
        var el = e.target;
        if (el.type === "checkbox") {
          var label = el.closest(".consent");
          if (label) label.classList.remove("is-invalid");
        } else {
          setFieldError(el, "");
        }
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var result = validate(form);
        if (!result.ok) {
          say("err", result.consent && !result.consent.checked ? T.consent : "");
          if (!result.consent || result.consent.checked) {
            status && status.removeAttribute("data-state");
          }
          if (result.firstBad) result.firstBad.focus();
          return;
        }

        if (!FORM_ENDPOINT) {
          say("warn", T.noEndpoint);
          if (window.console) console.warn("[МРО145] " + T.noEndpoint);
          return;
        }

        say("ok", T.sending);
        if (submit) submit.disabled = true;

        fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form)
        })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            form.reset();
            say("ok", T.ok);
          })
          .catch(function () {
            say("err", T.err);
          })
          .then(function () {
            if (submit) submit.disabled = false;
          });
      });
    });
  }

  /* ---------- 5. Появление блоков при прокрутке ---------- */

  function initReveal() {
    var items = $$(".reveal");
    if (!items.length) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-in");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------- 6. Бегущая строка: дублируем содержимое для бесшовности ---------- */

  function initTicker() {
    var track = $(".ticker__track");
    if (!track) return;
    var group = $(".ticker__group", track);
    if (!group) return;
    track.appendChild(group.cloneNode(true));
  }

  /* ---------- Запуск ---------- */

  function init() {
    initNav();
    initAccordion();
    initPhoneMask();
    initForms();
    initReveal();
    initTicker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
