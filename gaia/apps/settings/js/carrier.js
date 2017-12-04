/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/**
 * Singleton object that handles some cell and data settings.
 */
var CarrierSettings = (function(window, document, undefined) {
  var NETWORK_TYPE_SETTING = 'operatorResources.data.icon';
  var networkTypeMapping = {};

  var _networkTypeCategory = {
    'gprs': 'gsm',
    'edge': 'gsm',
    'umts': 'gsm',
    'hsdpa': 'gsm',
    'hsupa': 'gsm',
    'hspa': 'gsm',
    'hspa+': 'gsm',
    'lte': 'gsm',
    'gsm': 'gsm',
    'is95a': 'cdma',
    'is95b': 'cdma',
    '1xrtt': 'cdma',
    'evdo0': 'cdma',
    'evdoa': 'cdma',
    'evdob': 'cdma',
    'ehrpd': 'cdma'
  };

  var _;
  var _settings;
  var _mobileConnections;
  var _iccManager;
  var _voiceTypes;

  /** mozMobileConnection instance the panel settings rely on */
  var _mobileConnection = null;
  /** Flag */
  var _restartingDataConnection = false;

  /* Store the states of automatic operator selection */
  var _opAutoSelectStates = null;
  var gOperatorNetworkList = null;

  /**
   * Init function.
   */
  function cs_init() {
    _settings = window.navigator.mozSettings;
    _mobileConnections = window.navigator.mozMobileConnections;
    _iccManager = window.navigator.mozIccManager;
    if (!_settings || !_mobileConnections || !_iccManager) {
      return;
    }

    _voiceTypes = Array.prototype.map.call(_mobileConnections,
      function() { return null; });

    // Get the mozMobileConnection instace for this ICC card.
    _mobileConnection = _mobileConnections[
      DsdsSettings.getIccCardIndexForCellAndDataSettings()
    ];
    if (!_mobileConnection) {
      return;
    }

    cs_addVoiceTypeChangeListeners();
    cs_updateNetworkTypeLimitedItemsVisibility(
      _mobileConnection.voice && _mobileConnection.voice.type);

    // Show carrier name.
    cs_showCarrierName();

    // Init network type selector.
    cs_initNetworkTypeText(cs_initNetworkTypeSelector());

    // Set the navigation correctly when on a multi ICC card device.
    cs_initIccsUI();

    cs_initOperatorSelector();
    cs_initRoamingPreferenceSelector();

    // Init warnings the user sees before enabling data calls and roaming.
    cs_initWarnings();

    window.addEventListener('panelready', function(e) {
      // Get the mozMobileConnection instace for this ICC card.
      _mobileConnection = _mobileConnections[
        DsdsSettings.getIccCardIndexForCellAndDataSettings()
      ];
      if (!_mobileConnection) {
        return;
      }

      var currentHash = e.detail.current;
      if (currentHash === '#carrier') {
        cs_updateNetworkTypeLimitedItemsVisibility(
          _mobileConnection.voice && _mobileConnection.voice.type);
        // Show carrier name.
        cs_showCarrierName();
        return;
      } else if (currentHash === '#carrier-detail') {
        var detailHeader =
          document.querySelector('#carrier-detail gaia-header h1');
        detailHeader.setAttribute('data-l10n-id', 'simSettings');
      }

      if (!currentHash.startsWith('#carrier-') ||
          (currentHash === '#carrier-dc-warning') ||
          (currentHash === '#carrier-dr-warning')) {
        return;
      }

      if (currentHash === '#carrier-operatorSettings') {
        getSupportedNetworkInfo(_mobileConnection, function(result) {
          cs_updateNetworkTypeSelector(result);
          cs_updateAutomaticOperatorSelectionCheckbox();
        });
        return;
      }
    });
  }

  function cs_initIccsUI() {
    var isMultiSim = DsdsSettings.getNumberOfIccSlots() > 1;
    var carrierInfo = document.querySelector('#carrier .carrier-info');
    var advancedSettings =
      document.querySelector('#carrier .carrier-advancedSettings');
    var simSettings = document.querySelector('#carrier .carrier-simSettings');
    var operatorSettingsHeader =
      document.querySelector('#carrier-operatorSettings gaia-header');

    if (isMultiSim) {
      LazyLoader.load([
        '/js/carrier_iccs.js'
      ], function() {
        IccHandlerForCarrierSettings.init();
      });

      operatorSettingsHeader.dataset.href = '#carrier-detail';
    } else {
      operatorSettingsHeader.dataset.href = '#carrier';
    }
    carrierInfo.hidden = isMultiSim;
    advancedSettings.hidden = isMultiSim;
    simSettings.hidden = !isMultiSim;
  }

  /**
   * Add listeners on 'voicechange' for show/hide network type limited items.
   */
  function cs_addVoiceTypeChangeListeners() {
    Array.prototype.forEach.call(_mobileConnections, function(conn, index) {
      _voiceTypes[index] = conn.voice.type;
      conn.addEventListener('voicechange', function() {
        var newType = conn.voice.type;
        if (index !== DsdsSettings.getIccCardIndexForCellAndDataSettings() ||
            _voiceTypes[index] === newType) {
          return;
        }
        _voiceTypes[index] = newType;
        if (newType) {
          cs_updateNetworkTypeLimitedItemsVisibility(newType);
        }
      });
    });
  }

  /**
   * Update the network type limited items' visibility based on the voice type.
   */
  function cs_updateNetworkTypeLimitedItemsVisibility(voiceType) {
    // The following features are limited to GSM types.
    var autoSelectOperatorItem = document.getElementById('operator-autoSelect');
    var availableOperatorsHeader =
      document.getElementById('availableOperatorsHeader');
    var availableOperators = document.getElementById('availableOperators');
    // The following feature is limited to CDMA types.
    var roamingPreferenceItem =
      document.getElementById('operator-roaming-preference');

    autoSelectOperatorItem.hidden = availableOperatorsHeader.hidden =
      availableOperators.hidden = (_networkTypeCategory[voiceType] !== 'gsm');

    roamingPreferenceItem.hidden =
      (_networkTypeCategory[voiceType] !== 'cdma');
  }

  /**
   * Show the carrier name in the ICC card.
   */
  function cs_showCarrierName() {
    var desc = document.getElementById('dataNetwork-desc');
    var iccCard = _iccManager.getIccById(_mobileConnection.iccId);
    var network = _mobileConnection.voice.network;
    var iccInfo = iccCard.iccInfo;
    var carrier = network ? (network.shortName || network.longName) : null;

    if (carrier && iccInfo && iccInfo.isDisplaySpnRequired && iccInfo.spn) {
      if (iccInfo.isDisplayNetworkNameRequired && carrier !== iccInfo.spn) {
        carrier = carrier + ' ' + iccInfo.spn;
      } else {
        carrier = iccInfo.spn;
      }
    }
    desc.textContent = carrier;
  }

  /**
   * Helper function. Get the value for the ril.data.defaultServiceId setting
   * from the setting database.
   *
   * @param {Function} callback Callback function to be called once the work is
   *                            done.
   */
  function cs_getDefaultServiceIdForData(callback) {
    var request = _settings.createLock().get('ril.data.defaultServiceId');
    request.onsuccess = function onSuccessHandler() {
      var defaultServiceId =
        parseInt(request.result['ril.data.defaultServiceId'], 10);
      if (callback) {
        callback(defaultServiceId);
      }
    };
  }

  function cs_initNetworkTypeText(aNext) {
    var req;
    try {
      networkTypeMapping = {};
      req = _settings.createLock().get(NETWORK_TYPE_SETTING);
      req.onsuccess = function() {
        var networkTypeValues = req.result[NETWORK_TYPE_SETTING] || {};
        for (var key in networkTypeValues) {
          networkTypeMapping[key] = networkTypeValues[key];
        }
        aNext && aNext();
      };
      req.onerror = function() {
        console.error('Error loading ' + NETWORK_TYPE_SETTING + ' settings. ' +
                      req.error && req.error.name);
        aNext && aNext();
      };
    } catch (e) {
      console.error('Error loading ' + NETWORK_TYPE_SETTING + ' settings. ' +
                    e);
      aNext && aNext();
    }
  }

  /**
   * Init network type selector. Add the event listener that handles the changes
   * for the network type.
   */
  function cs_initNetworkTypeSelector() {
    if (!_mobileConnection.setPreferredNetworkType)
      return;

    var alertDialog = document.getElementById('preferredNetworkTypeAlert');
    var message = document.getElementById('preferredNetworkTypeAlertMessage');
    var continueButton = alertDialog.querySelector('button');
    continueButton.addEventListener('click', function onClickHandler() {
      alertDialog.hidden = true;
      getSupportedNetworkInfo(_mobileConnection, cs_updateNetworkTypeSelector);
    });

    var preferredNetworkTypeHelper =
      SettingsHelper('ril.radio.preferredNetworkType');

    var selector = document.getElementById('preferredNetworkType');
    selector.addEventListener('blur', function evenHandler() {
      var targetIndex = DsdsSettings.getIccCardIndexForCellAndDataSettings();
      var type = selector.value;
      var request = _mobileConnection.setPreferredNetworkType(type);

      request.onsuccess = function onSuccessHandler() {
        preferredNetworkTypeHelper.get(function gotPNT(values) {
          values[targetIndex] = type;
          preferredNetworkTypeHelper.set(values);
        });
      };
      request.onerror = function onErrorHandler() {
        message.setAttribute('data-l10n-id',
                             'preferredNetworkTypeAlertErrorMessage');
        alertDialog.hidden = false;
      };
    });
  }

  /**
   * Update network type selector.
   */
  function cs_updateNetworkTypeSelector(supportedNetworkTypeResult) {
    if (!_mobileConnection.getPreferredNetworkType ||
        !supportedNetworkTypeResult.networkTypes) {
      return;
    }

    var selector = document.getElementById('preferredNetworkType');
    // Clean up all option before updating again.
    while (selector.hasChildNodes()) {
      selector.removeChild(selector.lastChild);
    }

    var request = _mobileConnection.getPreferredNetworkType();
    request.onsuccess = function onSuccessHandler() {
      var supportedNetworkTypes = supportedNetworkTypeResult.networkTypes;
      var networkType = request.result;
      if (networkType) {
        supportedNetworkTypes.forEach(function(type) {
          var option = document.createElement('option');
          option.value = type;
          option.selected = (networkType === type);
          // show user friendly network mode names
          if (type in networkTypeMapping) {
            option.text = networkTypeMapping[type];
          } else {
            var l10nId = supportedNetworkTypeResult.l10nIdForType(type);
            option.setAttribute('data-l10n-id', l10nId);
            // fallback to the network type
            if (!l10nId) {
              option.textContent = type;
            }
          }
          selector.appendChild(option);
        });

      } else {
        console.warn('carrier: could not retrieve network type');
      }
    };
    request.onerror = function onErrorHandler() {
      console.warn('carrier: could not retrieve network type');
    };
  }

  /**
   * Network operator selection: auto/manual.
   */
  function cs_initOperatorSelector() {
    var opAutoSelect = document.getElementById('operator-autoSelect');
    var opAutoSelectInput = opAutoSelect.querySelector('input');
    var opAutoSelectState = opAutoSelect.querySelector('small');

    /**
     * Update selection mode.
     */
    function updateSelectionMode(scan) {
      var mode = _mobileConnection.networkSelectionMode;
      // we're assuming the auto-selection is ON by default.
      var auto = !mode || (mode === 'automatic');
      opAutoSelectInput.checked = auto;
      if (auto) {
        opAutoSelectState.setAttribute('data-l10n-id',
                                       'operator-networkSelect-auto');
      } else {
        opAutoSelectState.setAttribute('data-l10n-id',
                                       'operator-networkSelect-manual');
        if (scan) {
          gOperatorNetworkList.scan();
        }
      }
    }

    /**
     * Toggle autoselection.
     */
    opAutoSelectInput.onchange = function() {
      var targetIndex = DsdsSettings.getIccCardIndexForCellAndDataSettings();

      gOperatorNetworkList.setAutomaticSelection(targetIndex,
        this.checked);
    };

    /**
     * Create a network operator list item.
     */
    function newListItem(network, callback) {
      /**
       * A network list item has the following HTML structure:
       *   <li>
       *     <a>
       *       <span>Network Name</span>
       *       <small>Network State</small>
       *     </a>
       *   </li>
       */

      // name
      var name = document.createElement('span');
      name.textContent = network.shortName || network.longName;

      // state
      var state = document.createElement('small');
      state.setAttribute('data-l10n-id',
        network.state ? ('state-' + network.state) : 'state-unknown');

      var a = document.createElement('a');
      a.appendChild(name);
      a.appendChild(state);

      // create list item
      var li = document.createElement('li');
      li.appendChild(a);

      li.dataset.cachedState = network.state || 'unknown';
      li.classList.add('operatorItem');

      // bind connection callback
      li.onclick = function() {
        callback(network, true);
      };
      return li;
    }

    // operator network list
    gOperatorNetworkList = (function operatorNetworkList(list) {
      // get the "Searching..." and "Search Again" items, respectively
      var infoItem = list.querySelector('li[data-state="on"]');
      var scanItem = list.querySelector('li[data-state="ready"]');
      scanItem.onclick = scan;

      var currentConnectedNetwork = null;
      var connecting = false;
      var operatorItemMap = {};

      var scanRequest = null;

      var opAutoSelectStates = Array.prototype.map.call(_mobileConnections,
        function() { return true; });

      /**
       * Clear the list.
       */
      function clear() {
        operatorItemMap = {};
        var operatorItems = list.querySelectorAll('li:not([data-state])');
        var len = operatorItems.length;
        for (var i = len - 1; i >= 0; i--) {
          list.removeChild(operatorItems[i]);
        }
      }

      /**
       * Reset operator item state.
       */
      function resetOperatorItemState() {
        var operatorItems =
          Array.prototype.slice.call(list.querySelectorAll('.operatorItem'));
        operatorItems.forEach(function(operatorItem) {
          var state = operatorItem.dataset.cachedState;
          var messageElement = operatorItem.querySelector('small');

          if (!state) {
            state = 'unknown';
          } else if (state === 'current') {
            state = 'available';
          }

          messageElement.setAttribute('data-l10n-id', 'state-' + state);
        });
      }

      /**
       * Select operator.
       */
      function selectOperator(network, manuallySelect) {
        if (connecting) {
          return;
        }

        var listItem = operatorItemMap[network.mcc + '.' + network.mnc];
        if (!listItem) {
          return;
        }

        var messageElement = listItem.querySelector('small');

        connecting = true;
        // update current network state as 'available' (the string display
        // on the network to connect)
        if (manuallySelect) {
          resetOperatorItemState();
        }

        var req = _mobileConnection.selectNetwork(network);
        messageElement.setAttribute('data-l10n-id',
                                    'operator-status-connecting');
        req.onsuccess = function onsuccess() {
          currentConnectedNetwork = network;
          messageElement.setAttribute('data-l10n-id',
                                      'operator-status-connected');
          updateSelectionMode(false);
          connecting = false;
          checkAutomaticSelection();
        };
        req.onerror = function onerror() {
          connecting = false;
          checkAutomaticSelection();
          messageElement.setAttribute('data-l10n-id',
                                      'operator-status-connectingfailed');
          if (currentConnectedNetwork) {
            recoverAvailableOperator();
          } else {
            updateSelectionMode(false);
          }
        };
      }

      /**
       * Recover available operators.
       */
      function recoverAvailableOperator() {
        if (currentConnectedNetwork) {
          selectOperator(currentConnectedNetwork, false);
        }
      }

      /**
       * Scan available operators.
       */
      function scan() {
        clear();
        list.dataset.state = 'on'; // "Searching..."

        // invalidate the original request if it exists
        invalidateRequest(scanRequest);
        scanRequest = _mobileConnection.getNetworks();
        scanRequest.onsuccess = function onsuccess() {
          var networks = scanRequest.result;
          for (var i = 0; i < networks.length; i++) {
            var network = networks[i];
            var listItem = newListItem(network, selectOperator);
            list.insertBefore(listItem, scanItem);

            operatorItemMap[network.mcc + '.' + network.mnc] = listItem;
            if (network.state === 'current') {
              currentConnectedNetwork = network;
            }
          }
          list.dataset.state = 'ready'; // "Search Again" button

          scanRequest = null;
        };

        scanRequest.onerror = function onScanError(error) {
          console.warn('carrier: could not retrieve any network operator. ');
          list.dataset.state = 'ready'; // "Search Again" button

          scanRequest = null;
        };
      }

      function invalidateRequest(request) {
        if (request) {
          request.onsuccess = request.onerror = function() {};
        }
      }

      function stop() {
        list.dataset.state = 'off';
        clear();
        invalidateRequest(scanRequest);
        scanRequest = null;
      }

      var pendingAutomaticSelectionRequest = false;
      function checkAutomaticSelection() {
        if (pendingAutomaticSelectionRequest) {
          doEnableAutomaticSelection();
          pendingAutomaticSelectionRequest = false;
        }
      }

      function doEnableAutomaticSelection() {
        var req = _mobileConnection.selectNetworkAutomatically();
        req.onsuccess = function() {
          updateSelectionMode(false);
        };
      }

      function setAutomaticSelection(index, enabled) {
        opAutoSelectStates[index] = enabled;
        if (enabled) {
          stop();
          // When RIL is actively connecting to an operator, we are not able
          // to set automatic selection. Instead we set a flag indicating that
          // there is a pending automatic selection request.
          if (connecting) {
            pendingAutomaticSelectionRequest = true;
          } else {
            doEnableAutomaticSelection();
          }
        } else {
          pendingAutomaticSelectionRequest = false;
          scan();
        }
      }

      function getAutomaticSelection(index) {
        return opAutoSelectStates[index];
      }

      // API
      return {
        stop: stop,
        scan: scan,
        setAutomaticSelection: setAutomaticSelection,
        getAutomaticSelection: getAutomaticSelection
      };
    })(document.getElementById('availableOperators'));

    updateSelectionMode(true);
  }

  /**
   * Update the checkbox of the automatic operator selection.
   */
  function cs_updateAutomaticOperatorSelectionCheckbox() {
    var opAutoSelectInput =
      document.querySelector('#operator-autoSelect input');
    var targetIndex = DsdsSettings.getIccCardIndexForCellAndDataSettings();
    opAutoSelectInput.checked =
      gOperatorNetworkList.getAutomaticSelection(targetIndex);
    opAutoSelectInput.dispatchEvent(new Event('change'));
  }

  /**
   * Init roaming preference selector.
   */
  function cs_initRoamingPreferenceSelector() {
    if (!_mobileConnection.getRoamingPreference) {
      document.getElementById('operator-roaming-preference').hidden = true;
      return;
    }

    var defaultRoamingPreferences =
      Array.prototype.map.call(_mobileConnections,
        function() { return 'any'; });
    var roamingPreferenceHelper =
      SettingsHelper('ril.roaming.preference', defaultRoamingPreferences);

    var selector =
      document.getElementById('operator-roaming-preference-selector');
    var req = _mobileConnection.getRoamingPreference();
    req.onsuccess = function() {
      for (var i = 0; i < selector.options.length; i++) {
        var selection = selector.options[i];
        if (selection.value === req.result) {
          selection.selected = true;

          var evt = document.createEvent('Event');
          evt.initEvent('change', true, true);
          selector.dispatchEvent(evt);
          break;
        }
      }
    };

    req.onerror = function() {
      console.warn('carrier: ' + req.error.name);
    };

    selector.addEventListener('blur', function() {
      var index = this.selectedIndex;
      if (index >= 0) {
        var selection = this.options[index];
        roamingPreferenceHelper.get(function gotRP(values) {
          var targetIndex =
            DsdsSettings.getIccCardIndexForCellAndDataSettings();
          var setReq = _mobileConnection.setRoamingPreference(selection.value);
          setReq.onsuccess = function set_rp_success() {
            values[targetIndex] = selection.value;
            roamingPreferenceHelper.set(values);
          };
          setReq.onerror = function set_rp_error() {
            selector.value = values[targetIndex];
          };
        });
      }
    });
  }

  /**
   * Init some cell and data warning dialogs such as the one related to
   * enable data calls and the related to enable data calls in roaming.
   */
  function cs_initWarnings() {
    /**
     * Init a warning dialog.
     *
     * @param {String} settingKey The key of the setting.
     * @param {String} dialogId The id of the warning dialog.
     * @param {String} explanationItemId The id of the explanation item.
     * @param {Function} warningDisabledCallback Callback function to be
     *                                           called once the warning is
     *                                           disabled.
     */
    function initWarning(settingKey,
                         dialogId,
                         explanationItemId,
                         warningDisabledCallback) {

      var warningDialogEnabledKey = settingKey + '.warningDialog.enabled';
      var explanationItem = document.getElementById(explanationItemId);

      /**
       * Figure out whether the warning is enabled or not.
       *
       * @param {Function} callback Callback function to be called once the
       *                            work is done.
       */
      function getWarningEnabled(callback) {
        window.asyncStorage.getItem(warningDialogEnabledKey,
                                    function getItemCb(warningEnabled) {
          if (warningEnabled === null) {
            warningEnabled = true;
          }
          if (callback) {
            callback(warningEnabled);
          }
        });
      }

      /**
       * Set the value of the setting into the settings database.
       *
       * @param {Boolean} state State to be stored.
       */
      function setState(state) {
        var cset = {};
        cset[settingKey] = !!state;
        _settings.createLock().set(cset);
      }

      /**
       * Helper function. Handler to be called once the user click on the
       * accept button form the warning dialog.
       */
      function onSubmit() {
        window.asyncStorage.setItem(warningDialogEnabledKey, false);
        explanationItem.hidden = false;
        setState(true);
        if (warningDisabledCallback) {
          warningDisabledCallback();
        }
      }

      /**
       * Helper function. Handler to be called once the user click on the
       * cancel button form the warning dialog.
       */
      function onReset() {
        window.asyncStorage.setItem(warningDialogEnabledKey, true);
      }

      // Register an observer to monitor setting changes.
      _settings.addObserver(settingKey, function observerCb(event) {
        getWarningEnabled(function getWarningEnabledCb(warningEnabled) {
          var enabled = event.settingValue;
          if (warningEnabled) {
            if (enabled) {
              setState(false);
              openDialog(dialogId, onSubmit, onReset);
            }
          } else {
            explanationItem.hidden = false;
          }
        });
      });

      // Initialize the visibility of the warning message.
      getWarningEnabled(function getWarningEnabledCb(warningEnabled) {
        if (warningEnabled) {
          var request = _settings.createLock().get(settingKey);
          request.onsuccess = function onSuccessCb() {
            var enabled = false;
            if (request.result[settingKey] !== undefined) {
              enabled = request.result[settingKey];
            }
            if (enabled) {
              window.asyncStorage.setItem(warningDialogEnabledKey, false);
              explanationItem.hidden = false;
            }
          };
        } else {
          explanationItem.hidden = false;
          if (warningDisabledCallback) {
            warningDisabledCallback();
          }
        }
      });
    }

    /**
     * Turn off data roaming automatically when users turn off data calls.
     */
    function warningDataEnabledCb() {
       _settings.addObserver('ril.data.enabled', function observerCb(event) {
         if (!event.settingValue && _restartingDataConnection) {
           var cset = {};
           cset['ril.data.roaming_enabled'] = false;
           _settings.createLock().set(cset);
         }
      });
    }

    initWarning('ril.data.enabled',
                'carrier-dc-warning',
                'dataConnection-expl',
                warningDataEnabledCb);
    initWarning('ril.data.roaming_enabled',
                'carrier-dr-warning',
                'dataRoaming-expl');
  }

  return {
    init: cs_init
  };
})(this, document);

CarrierSettings.init();