import { readFileSync, existsSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const componentCss = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../src/app/main.mjs', import.meta.url), 'utf8');
const androidManifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');

assert(existsSync(new URL('../src/domain/ledger-core.mjs', import.meta.url)), 'domain core should live under src/domain');
for (const domainFile of ['budget-core.mjs', 'account-core.mjs', 'pending-core.mjs', 'category-rules.mjs', 'duplicate-core.mjs', 'achievement-core.mjs']) {
  assert(existsSync(new URL(`../src/domain/${domainFile}`, import.meta.url)), `${domainFile} should live under src/domain`);
}
assert(existsSync(new URL('../src/app/main.mjs', import.meta.url)), 'app bootstrap should live under src/app');
assert(existsSync(new URL('../android/app/src/main/java/com/fanrenge/todayledger/PaymentNotificationListener.java', import.meta.url)), 'apk should include a native payment notification listener');
assert(existsSync(new URL('../android/app/src/main/java/com/fanrenge/todayledger/PaymentAccessibilityService.java', import.meta.url)), 'apk should include a native payment accessibility service');
assert(existsSync(new URL('../android/app/src/main/java/com/fanrenge/todayledger/PaymentNotificationsPlugin.java', import.meta.url)), 'apk should include a Capacitor payment notification bridge');
assert(existsSync(new URL('../android/app/src/main/java/com/fanrenge/todayledger/PaymentCaptureStore.java', import.meta.url)), 'payment capture services should share local capture settings');
assert(existsSync(new URL('../android/app/src/main/res/xml/payment_accessibility_service.xml', import.meta.url)), 'apk should declare accessibility service config');
for (const appFile of ['render-record.mjs', 'render-details.mjs', 'render-budget.mjs', 'render-accounts.mjs', 'render-pending.mjs', 'render-ai.mjs']) {
  assert(existsSync(new URL(`../src/app/${appFile}`, import.meta.url)), `${appFile} should live under src/app`);
}
assert(existsSync(new URL('../src/styles/tokens.css', import.meta.url)), 'style tokens should live under src/styles');
assert(existsSync(new URL('../src/styles/layout.css', import.meta.url)), 'layout styles should live under src/styles');
assert(existsSync(new URL('../src/styles/components.css', import.meta.url)), 'component styles should live under src/styles');
assert(html.includes('./src/app/main.mjs'), 'index should load split app entry');
assert(css.includes('./src/styles/tokens.css'), 'root stylesheet should import split tokens');
assert(css.includes('./src/styles/layout.css'), 'root stylesheet should import split layout');
assert(css.includes('./src/styles/components.css'), 'root stylesheet should import split components');

assert(html.includes('id="themePickerButton"'), 'top style control should open the in-app theme picker');
assert(!html.includes('href="./style-options.html"'), 'top style control should not navigate to the old style candidate page');
assert(html.includes('id="themeSheet"'), 'theme picker should live inside the main app');
for (const themeId of ['pastel', 'guofeng', 'status-terminal', 'alcheris-pixel']) {
  assert(html.includes(`data-theme-choice="${themeId}"`), `theme picker should include ${themeId}`);
  assert(appJs.includes(`id: '${themeId}'`), `app theme options should include ${themeId}`);
}
for (const removedTheme of ['gothic', 'celtic-paladin']) {
  assert(!html.includes(`data-theme-choice="${removedTheme}"`), `theme picker should not include removed ${removedTheme}`);
  assert(!appJs.includes(`id: '${removedTheme}'`), `app theme options should not include removed ${removedTheme}`);
}
for (const themeClass of ['theme-pastel', 'theme-guofeng', 'theme-status-terminal', 'theme-alcheris-pixel']) {
  assert(componentCss.includes(themeClass), `ledger app should include ${themeClass}`);
}
assert(!componentCss.includes('theme-swatch.gothic'), 'removed gothic swatch CSS should not remain');
assert(!componentCss.includes('theme-swatch.celtic-paladin'), 'removed celtic swatch CSS should not remain');
assert(componentCss.includes('theme-guofeng') && componentCss.includes('SimSun'), 'guofeng theme should use a bookish serif font');
assert(componentCss.includes('theme-status-terminal') && componentCss.includes('backdrop-filter'), 'status terminal theme should use frosted glass surfaces');
assert(componentCss.includes('theme-alcheris-pixel') && componentCss.includes('image-rendering: pixelated'), 'pixel theme should use pixel styling, not only dark colors');
assert(appJs.includes('themeOptions'), 'app should define small-phone theme options');
assert(appJs.includes('setLedgerTheme'), 'app should save selected small-phone theme');
assert(appJs.includes("activePage = state.settings.defaultPage || 'record'"), 'app should default to the configured record page');
assert(appJs.includes('buildBudgetSummary'), 'app should use budget summary data');
assert(appJs.includes('findDuplicateCandidates'), 'app should detect possible duplicate entries');
assert(appJs.includes('inferCategoryByKeywords'), 'app should infer categories from note keywords');
assert(appJs.includes('buildPendingSummary'), 'app should summarize pending items');
assert(appJs.includes('applyEntryToAccounts'), 'app should update lightweight accounts');
assert(appJs.includes('buildAchievements'), 'data page should use achievement-style statistics');
assert(appJs.includes('setLedgerFont'), 'app should save selected font style');
assert(appJs.includes('syncDetectedPayments'), 'app should sync native payment notifications into ledger entries');
assert(appJs.includes('openPaymentAccessibilitySettings'), 'app should open Android accessibility settings');
assert(appJs.includes('savePaymentCaptureSettings'), 'app should save user-controlled payment capture settings');
assert(appJs.includes('loadInstalledApps'), 'app should load installed apps into the local whitelist picker');
assert(androidManifest.includes('android.service.notification.NotificationListenerService'), 'android manifest should register notification listener service');
assert(androidManifest.includes('android.accessibilityservice.AccessibilityService'), 'android manifest should register accessibility service');
assert(androidManifest.includes('android.permission.QUERY_ALL_PACKAGES'), 'android manifest should allow the local installed-app picker to see installed apps');

assert(!html.includes('timeBuckets'), 'detail page should not include bookkeeping time bucket UI');
assert(!html.includes('time-panel'), 'detail page should not include time panel');
assert(!html.includes('chartsPage'), 'charts should be folded into detail instead of a separate page');
assert(!html.includes('chatInput'), 'evaluation page should not expose free-form character chat');
assert(!html.includes('sendChat'), 'evaluation page should not expose chat send action');
assert(html.includes('data-detail-scope="all"'), 'detail page should offer all-time scope');
assert(html.includes('data-detail-scope="day"'), 'detail page should offer selected-day scope');
assert(html.includes('data-detail-scope="week"'), 'detail page should offer weekly scope');
assert(html.includes('data-detail-scope="month"'), 'detail page should offer monthly scope');
assert(html.includes('data-detail-scope="year"'), 'detail page should offer yearly scope');
assert(!html.includes('data-detail-scope="chart"'), 'chart view should not be mixed into time scope');
assert(html.includes('id="detailViewTabs"'), 'detail page should separate visual view controls from time scope');
assert(html.includes('data-detail-view="list"'), 'detail page should offer list view');
assert(html.includes('data-detail-view="pie"'), 'detail page should offer pie chart view');
assert(html.includes('data-detail-view="bar"'), 'detail page should offer bar chart view');
assert(html.includes('id="calendarPrev"'), 'calendar should include previous month control');
assert(html.includes('id="calendarNext"'), 'calendar should include next month control');
assert(componentCss.includes('.calendar-day.selected'), 'calendar should style the selected day without harsh gray');

assert(html.includes('data-mine-panel="categories"'), 'mine page should expose category management');
assert(html.includes('data-mine-panel="budget"'), 'mine page should expose budget management');
assert(html.includes('data-mine-panel="accounts"'), 'mine page should expose account management');
assert(html.includes('data-mine-panel="pending"'), 'mine page should expose pending item management');
assert(html.includes('id="budgetMonthlyLimit"'), 'budget panel should edit monthly limit');
assert(html.includes('id="accountList"'), 'account panel should list accounts');
assert(html.includes('id="paymentCaptureStatus"'), 'account panel should show native payment capture status');
assert(html.includes('id="openPaymentNotificationSettings"'), 'account panel should open Android notification listener settings');
assert(html.includes('id="openPaymentAccessibilitySettings"'), 'account panel should open Android accessibility settings');
assert(html.includes('id="paymentAppWhitelist"'), 'account panel should let users edit the local app whitelist');
assert(html.includes('id="paymentKeywordList"'), 'account panel should let users edit local payment keywords');
assert(html.includes('id="savePaymentCaptureSettings"'), 'account panel should save local capture settings');
assert(html.includes('id="loadInstalledApps"'), 'account panel should load installed apps for whitelist selection');
assert(html.includes('id="installedAppSearch"'), 'account panel should search installed apps');
assert(html.includes('id="installedAppList"'), 'account panel should render installed app choices');
assert(html.includes('id="pendingItemList"'), 'pending panel should list pending items');
assert(html.includes('id="budgetHint"'), 'record page should show budget hints');
assert(html.includes('id="accountSelect"'), 'record page should select payment account');
assert(html.includes('id="transferFields"'), 'record page should expose transfer account fields');
assert(html.includes('id="categoryEditorList"'), 'category management should list editable categories');
assert(html.includes('id="categoryNameInput"'), 'category management should allow custom category names');
assert(html.includes('id="categoryIconInput"'), 'category management should allow custom category icons');
assert(html.includes('id="addCategory"'), 'category management should allow adding categories');
assert(html.includes('id="contactDetail"'), 'contacts should include a selected contact detail panel');
assert(html.includes('multiple'), 'character import should allow importing multiple cards like contacts');
assert(html.includes('data-mine-panel="worldbooks"'), 'mine page should expose worldbook management');
assert(html.includes('id="worldBookImport"'), 'worldbook management should import SillyTavern world books');
assert(html.includes('id="evaluationPrompt"'), 'worldbook page should show the editable global evaluation prompt');
assert(html.includes('id="saveEvaluationPrompt"'), 'worldbook page should save the global evaluation prompt');
assert(html.includes('id="resetEvaluationPrompt"'), 'worldbook page should restore the default evaluation prompt');
assert(html.includes('id="addWorldBook"'), 'worldbook management should allow creating a world book manually');
assert(html.includes('id="worldBookList"'), 'worldbook management should list imported world books');
assert(html.includes('id="insightPresetImport"'), 'data page should allow importing AI summary presets');
assert(html.includes('id="generateInsight"'), 'data page should allow generating AI spending summaries');
assert(html.includes('id="insightOutput"'), 'data page should display AI spending summaries');
assert(html.includes('id="achievementBoard"'), 'data page should show an achievement board');
assert(html.includes('id="characterDataComments"'), 'data page should show one data comment per enabled character');
assert(html.includes('id="fontSelect"'), 'theme sheet should include a font selector');
assert(html.includes('id="userPersona"'), 'user profile should include editable persona text');
assert(html.includes('id="userPromptNote"'), 'user profile should include editable prompt preferences');

assert(componentCss.includes('character-editor'), 'contacts should style a character edit form');
assert(componentCss.includes('worldbook-entry-editor'), 'worldbook entries should have editable styling');
assert(appJs.includes('confirm('), 'entry delete should ask for confirmation before removing');
assert(appJs.includes('data-delete-worldbook-entry'), 'standalone worldbook entries should have delete handlers');
assert(appJs.includes('data-delete-character-worldbook-entry'), 'embedded character worldbook entries should have delete handlers');
assert(appJs.includes('categoryIconSvgs'), 'category icons should use a unified minimal icon set');
assert(appJs.includes('playKeypadTap'), 'keypad should play a small tap sound');
assert(appJs.includes('key-pressed'), 'keypad buttons should expose pressed visual feedback');
assert(componentCss.includes('.keypad button.key-pressed'), 'keypad pressed state should be styled');
assert(appJs.includes('flashTapTarget'), 'ordinary clickable controls should have tap feedback');
assert(appJs.includes('tap-pressed'), 'ordinary click feedback should use a visible pressed class');
assert(componentCss.includes('.tap-pressed'), 'ordinary pressed state should be styled with visible color feedback');

assert(html.includes('id="fetchModels"'), 'api settings should include a fetch models action');
assert(html.includes('<select id="apiModel"'), 'api model should be selected from fetched models instead of typed manually');
assert(appJs.includes('fetchModels'), 'app should implement model fetching');
assert(appJs.includes('buildModelsEndpoint'), 'app should build a models endpoint from API base URL');
assert(appJs.includes('/models'), 'model fetching should call an OpenAI-compatible models endpoint');
assert(appJs.includes("renderAvatar({ avatar: message.avatar, characterName: message.characterName }, 'bubble-avatar')"), 'evaluation bubbles should render image avatars instead of data URLs as text');
assert(componentCss.includes('.bubble-avatar') && componentCss.includes('overflow: hidden;'), 'bubble avatars should clip imported image avatars');
assert(appJs.includes('saveEvaluationPrompt'), 'app should save editable evaluation prompt text');
assert(appJs.includes('addWorldBookEntry'), 'app should allow manually adding worldbook entries');
assert(componentCss.includes('.achievement-board'), 'data page should style the achievement board');
assert(componentCss.includes('.settings-panel[data-mine-panel-view="accounts"]'), 'account panel should have a distinct readable color accent');
assert(componentCss.includes('.settings-panel[data-mine-panel-view="api"]'), 'api panel should have a distinct readable color accent');
assert(componentCss.includes('.evaluation-toggle'), 'role evaluation comments should have a collapse control');
assert(appJs.includes('const isCollapsed = messages.length > 0'), 'role evaluation collapse should hide the first comment too');
assert(appJs.includes('const visibleMessages = isCollapsed ? [] : messages'), 'collapsed role comments should hide every character bubble');
assert(componentCss.includes('font-rounded'), 'font selector should include a rounded font class');
assert(appJs.includes('toggleEvaluationCollapse'), 'app should collapse and expand role comments');

console.log('standalone ledger architecture ok');