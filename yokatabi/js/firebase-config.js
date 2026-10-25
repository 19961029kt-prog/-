// Firebase のウェブ用の設定値（q-trip-a127e）。秘密の情報ではない（守りは Security Rules と App Check が受け持つ）。
// index.html と local.html で読み込み、js/firebase.js が使う。SDK はサイトの中の写し（js/vendor/）を、必要になったときだけ読む。
// measurementId（Google アナリティクス）は使わない：旅人の行動を外へ送る計測は入れない方針。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  YT.firebaseConfig = Object.freeze({
    apiKey: 'AIzaSyABUZkpl-NnYAah4dzNS6_HNMCxQQYy4sw',
    authDomain: 'q-trip-a127e.firebaseapp.com',
    projectId: 'q-trip-a127e',
    storageBucket: 'q-trip-a127e.firebasestorage.app',
    messagingSenderId: '294839134497',
    appId: '1:294839134497:web:2c08b6a0f095cbfdf03660',
  });
})();
