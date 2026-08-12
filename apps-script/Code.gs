/**
 * МРО 145 АВИАКОМПОНЕНТ — приём заявок с сайта в Google Таблицу.
 *
 * Этот скрипт живёт внутри Google Таблицы (Расширения → Apps Script)
 * и публикуется как веб-приложение. Форма на сайте отправляет на его адрес
 * POST-запрос, а скрипт дописывает строку в лист «Заявки».
 *
 * Как переустановить с нуля — см. README.md, раздел «Заявки с формы».
 *
 * ВАЖНО: после любой правки этого файла нужно заново нажать
 * «Развернуть» → «Управление развёртываниями» → карандаш → «Создать» → версия «Новая».
 * Без этого сайт продолжит работать со старой версией скрипта.
 */

/* ------------------------------------------------------------------ */
/*  Настройки                                                          */
/* ------------------------------------------------------------------ */

/** Название листа, куда падают заявки. Создаётся автоматически. */
var SHEET_NAME = 'Заявки';

/**
 * Куда присылать письмо о новой заявке.
 * Пустая строка — письма не отправляются, заявки просто копятся в таблице.
 * Пример: 'info@mro145.ru'  (можно несколько через запятую)
 *
 * ВНИМАНИЕ: одного адреса мало. Разрешения скрипта сознательно сужены
 * до одной таблицы (см. appsscript.json), права на отправку почты у него нет.
 * Чтобы включить письма, нужно добавить в appsscript.json второе разрешение:
 *   "https://www.googleapis.com/auth/script.send_mail"
 * затем выпустить новую версию развёртывания и подтвердить доступ у Google.
 */
var NOTIFY_EMAIL = '';

/** Колонки таблицы: подпись в шапке и имя поля из формы. */
var COLUMNS = [
  ['Дата и время', 'timestamp'],
  ['Имя',          'name'],
  ['Телефон',      'phone'],
  ['Комментарий',  'comment'],
  ['Язык',         'lang'],
  ['Страница',     'page']
];

/* ------------------------------------------------------------------ */
/*  Приём заявки                                                       */
/* ------------------------------------------------------------------ */

/** Предельная длина полей: защита от записи гигантского текста в таблицу. */
var LIMITS = { name: 100, phone: 30, comment: 2000, lang: 5, page: 200 };

function doPost(e) {
  try {
    var data = (e && e.parameter) || {};

    // Ловушка для спам-ботов: поле «website» скрыто от людей стилями.
    // Живой посетитель его не видит и не заполняет, бот — заполняет.
    // Отвечаем «успех», чтобы бот не понял, что его отсеяли.
    if (data.website) {
      return reply({ ok: true });
    }

    var phone = cut(data.phone, LIMITS.phone);
    var name  = cut(data.name, LIMITS.name);

    // Телефон проверяется и на сайте, но на это нельзя полагаться:
    // запрос можно отправить в обход формы, минуя проверки в браузере.
    if (phone.replace(/\D/g, '').length < 11) {
      return reply({ ok: false, error: 'Некорректная заявка' });
    }

    if (!name) {
      return reply({ ok: false, error: 'Некорректная заявка' });
    }

    var sheet = getSheet();
    var row = COLUMNS.map(function (column) {
      var field = column[1];
      if (field === 'timestamp') {
        return Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss');
      }
      // Апостроф не даёт таблице превратить «+7 (915)…» в формулу или число
      var value = cut(data[field], LIMITS[field] || 500);
      return field === 'phone' && value ? "'" + value : value;
    });

    sheet.appendRow(row);

    // Телефон делаем кликабельным прямо в таблице
    var lastRow = sheet.getLastRow();
    if (phone) {
      var digits = phone.replace(/\D/g, '');
      if (digits) {
        sheet.getRange(lastRow, indexOfField('phone') + 1)
             .setFormula('=HYPERLINK("tel:+' + digits + '";"' + phone.replace(/"/g, '') + '")');
      }
    }

    notify(name, phone, cut(data.comment, LIMITS.comment));

    return reply({ ok: true });
  } catch (err) {
    // Наружу отдаём общую фразу: подробности об устройстве скрипта
    // посторонним не нужны. Настоящая ошибка видна владельцу
    // в Apps Script → «Выполнения».
    console.error(err);
    return reply({ ok: false, error: 'Внутренняя ошибка' });
  }
}

/** Обрезает значение до допустимой длины и убирает лишние пробелы. */
function cut(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

/** Открыв адрес скрипта в браузере, можно убедиться, что он жив. */
function doGet() {
  return reply({ ok: true, service: 'МРО 145 — приём заявок' });
}

/* ------------------------------------------------------------------ */
/*  Вспомогательное                                                    */
/* ------------------------------------------------------------------ */

function getSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }

  // Шапка создаётся один раз, при самой первой заявке
  if (sheet.getLastRow() === 0) {
    var titles = COLUMNS.map(function (column) { return column[0]; });
    sheet.appendRow(titles);

    var header = sheet.getRange(1, 1, 1, titles.length);
    header.setFontWeight('bold').setBackground('#1670c6').setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    sheet.setColumnWidth(1, 150);  // дата и время
    sheet.setColumnWidth(2, 170);  // имя
    sheet.setColumnWidth(3, 160);  // телефон
    sheet.setColumnWidth(4, 420);  // комментарий
    sheet.setColumnWidth(5, 70);   // язык
    sheet.setColumnWidth(6, 220);  // страница
  }

  return sheet;
}

function indexOfField(field) {
  for (var i = 0; i < COLUMNS.length; i++) {
    if (COLUMNS[i][1] === field) return i;
  }
  return -1;
}

function notify(name, phone, comment) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Новая заявка с сайта МРО 145',
      body: [
        'Имя: ' + (name || 'не указано'),
        'Телефон: ' + (phone || 'не указан'),
        'Комментарий: ' + (comment || 'нет'),
        '',
        'Таблица со всеми заявками: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
      ].join('\n')
    });
  } catch (err) {
    // Письмо — не главное: если почта не ушла, заявка всё равно уже в таблице
    console.error('Не удалось отправить письмо: ' + err);
  }
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
