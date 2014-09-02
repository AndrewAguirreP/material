/* Disable Tab Pagination */
/**
 * @ngdoc module
 * @name material.components.tabs
 * @description
 *
 * Tabs
 */
angular.module('material.components.tabs', [
  'material.animations',
  'material.services.attrBind',
  'material.services.registry'
])
  .controller('materialTabsController', [
    '$scope', 
    '$attrs', 
    '$materialComponentRegistry', 
    '$timeout',
    '$$rAF',
    TabsController
  ])
  .directive('materialTabs', [
    '$compile', 
    '$timeout', 
    '$materialEffects', 
    '$window',
    '$$rAF',
    '$aria',
    TabsDirective
  ])
  .directive('materialTab', [ 
    '$attrBind',
    '$aria',
    TabDirective  
  ]);

/**
 * @ngdoc directive
 * @name materialTabs
 * @module material.components.tabs
 * @order 0
 *
 * @restrict E
 *
 * @description
 * The `<material-tabs>` directive serves as the container for 1..n `<material-tab>` child directives to produces a Tabs components.
 * In turn, the nested `<material-tab>` directive is used to specify a tab label for the **header button** and a [optional] tab view
 * content that will be associated with each tab button.
 *
 * Below is the markup for its simplest usage:
 *
 *  <hljs lang="html">
 *  <material-tabs>
 *    <material-tab label="Tab #1"></material-tab>
 *    <material-tab label="Tab #2"></material-tab>
 *    <material-tab label="Tab #3"></material-tab>
 *  <material-tabs>
 *  </hljs>
 *
 * Tabs supports three (3) usage scenarios:
 *
 *  1. Tabs (buttons only)
 *  2. Tabs with internal view content
 *  3. Tabs with external view content
 *
 * **Tab-only** support is useful when tab buttons are used for custom navigation regardless of any other components, content, or views.
 * **Tabs with internal views** are the traditional usages where each tab has associated view content and the view switching is managed internally by the Tabs component.
 * **Tabs with external view content** is often useful when content associated with each tab is independently managed and data-binding notifications announce tab selection changes.
 *
 * > As a performance bonus, if the tab content is managed internally then the non-active (non-visible) tab contents are temporarily disconnected from the `$scope.$digest()` processes; which restricts and optimizes DOM updates to only the currently active tab.
 *
 * Additional features also include:
 *
 * *  Content can include any markup.
 * *  If a tab is disabled while active/selected, then the next tab will be auto-selected.
 * *  If the currently active tab is the last tab, then next() action will select the first tab.
 * *  Any markup (other than **`<material-tab>`** tags) will be transcluded into the tab header area BEFORE the tab buttons.
 *
 * @param {integer=} selected Index of the active/selected tab
 * @param {boolean=} noink Flag indicates use of ripple ink effects
 * @param {boolean=} nobar Flag indicates use of ink bar effects
 * @param {boolean=} nostretch Flag indicates use of elastic animation for inkBar width and position changes
 * @param {string=}  align-tabs Attribute to indicate position of tab buttons: bottom or top; default is `top`
 *
 * @usage
 * <hljs lang="html">
 * <material-tabs selected="selectedIndex" >
 *   <img ng-src="/img/angular.png" class="centered">
 *
 *   <material-tab
 *      ng-repeat="tab in tabs | orderBy:predicate:reversed"
 *      on-select="onTabSelected(tab)"
 *      on-deselect="announceDeselected(tab)"
 *      disabled="tab.disabled" >
 *
 *       <material-tab-label>
 *           {{tab.title}}
 *           <img src="/img/removeTab.png"
 *                ng-click="removeTab(tab)"
 *                class="delete" >
 *       </material-tab-label>
 *
 *       {{tab.content}}
 *
 *   </material-tab>
 *
 * </material-tabs>
 * </hljs>
 *
 */
function TabsDirective($compile, $timeout, $materialEffects, $window, $$rAF, $aria) {

  return {
    restrict: 'E',
    replace: false,
    transclude: 'true',

    scope: {
      $selIndex: '=?selected'
    },

    compile: compileTabsFn,
    controller: [ '$scope', '$attrs', '$materialComponentRegistry', '$timeout', '$$rAF', TabsController ],

    template:
      '<div class="tabs-header" ng-class="{\'tab-paginating\': pagination.active}">' +

      '  <div class="tab-paginator prev" ng-if="pagination.active" ng-click="pagination.hasPrev && pagination.prev()" ng-class="{active: pagination.hasPrev}">' +
      '  </div>' +
      '  <div class="tabs-header-items-container">' +
      '    <div class="tabs-header-items"></div>' +
      '  </div>' +
      '  <div class="tab-paginator next" ng-if="pagination.active" ng-click="pagination.hasNext && pagination.next()" ng-class="{active: pagination.hasNext}">' +
      '  </div>' +
      '  <material-ink-bar></material-ink-bar>' +

      '</div>'+
      '<div class="tabs-content ng-hide"></div>'

  };

  /**
   * Use prelink to configure inherited scope attributes: noink, nobar, and nostretch;
   * do this before the child elements are linked.
   *
   * @param element
   * @param attr
   * @returns {{pre: materialTabsLink}}
   */
  function compileTabsFn() {

    return {
      pre: function tabsPreLink(scope, element, attrs, tabsController) {

        // These attributes do not have values; but their presence defaults to value == true.
        scope.noink = angular.isDefined(attrs.noink);
        scope.nobar = angular.isDefined(attrs.nobar);
        scope.nostretch = angular.isDefined(attrs.nostretch);

        // Publish for access by nested `<material-tab>` elements
        tabsController.noink = scope.noink;

        scope.$watch('$selIndex', function (index) {
          tabsController.selectAt(index);
        });

        // Remove the `inkBar` element if `nobar` is defined
        var elBar = findNode("material-ink-bar",element);
        if ( elBar && scope.nobar ) {
          elBar.remove();
        }

      },
      post: function tabsPostLink(scope, element, attrs, tabsController, $transclude) {
        var  cache = {
          length: 0,
          contains: function (tab) {
            return !angular.isUndefined(cache[tab.$id]);
          }
        };
        var updatePagination = configurePagination() || angular.noop;
        var updateInk = configureInk( scope.nostretch ) || angular.noop;
        var update = $$rAF.debounce(function() {
          /* See decorators.js for raf.debounce */
          updatePagination();
          updateInk();
        });

        angular.element($window).on('resize', update);
        scope.$on('$materialTabsChanged', update);

        transcludeHeaderItems();
        transcludeContentItems();

        configureAria();  // Update ARIA values for the Tab group (Tabs)

        alignTabButtons();
        selectDefaultTab();

        // **********************************************************
        // Private Methods
        // **********************************************************

        /**
         * Inject ARIA-specific attributes appropriate for Tab Groups
         */
        function configureAria() {
          var ROLE = Constant.ARIA.ROLE;

          $aria.update( element, {
            'id': buildAriaID(),
            'role': ROLE.TAB_LIST
          });

          /**
           * Build a unique Tabs ID for WAI-ARIA; preserve the existing ID if already
           * specified.
           * @returns {*|string}
           */
          function buildAriaID() {
            return  attrs.id || ("tabs" + "_" + scope.$id);
          }
        }

        /**
         * Conditionally configure ink bar animations when the
         * tab selection changes. If `nobar` then do not show the
         * bar nor animate.
         */
        function configureInk( nostretch ) {
          if ( scope.nobar ) return;

          // Single inkBar is used for all tabs
          var inkBar = findNode("material-ink-bar", element);
          var tabsHeader = findNode('.tabs-header-items-container', element); // excludes paginators
          var lastLeft = 0;

          // Immediately place the ink bar
          updateInkBar(true);

          // Delay inkBar updates 1-frame until pagination updates...
          return $$rAF.debounce(updateInkBar);

          /**
           * Update the position and size of the ink bar based on the
           * specified tab DOM element. If all tabs have been removed, then
           * hide the inkBar.
           *
           * @param tab
           * @param skipAnimation
           */
          function updateInkBar( immediate ) {
            var getWidth = Util.css.width, getLeft = Util.css.left;

            var selButton = tabsController.selectedElement();
            var showInk = selButton && selButton.length && angular.isDefined(inkBar);
            var isHiding = selButton && selButton.hasClass('pagination-hide');

            var styles = { display : 'none', width : '0px' };
            var left = 0, width = 0;

            if ( !showInk || isHiding ) {
              // no animation

              inkBar.toggleClass('animate', (immediate !== true))
                .css({
                  display : 'none',
                  width : '0px'
                });
            }
            else {
              // Just a linear animation...

              width = getWidth(selButton);
              left = getLeft(tabsHeader) + (scope.pagingOffset || 0) + getLeft(selButton);

              styles = {
                display : width > 0 ? 'block' : 'none',
                width: width + 'px'
              };
              styles[$materialEffects.TRANSFORM] = 'translate3d(' + left + 'px,0,0)';

              // Before we update the CSS to create a linear slide effect,
              // let's add/remove `animate` class for transition & duration

              inkBar.toggleClass('animate', (immediate !== true) )
                .css(styles);

            }
          }
        }

        /**
         * Configure pagination and add listeners for tab changes
         * and Tabs width changes...
         *
         * @returns {updatePagination}
         */
        function configurePagination() {

          var TAB_MIN_WIDTH = 8 * 12;           // Must match tab min-width rule in _tabs.scss
          var PAGINATORS_WIDTH = (8 * 4) * 2;   // Must match (2 * width of paginators) in scss

          var buttonBar = findNode('.tabs-header-items', element);
          var pagination = scope.pagination = {
            next: function() { selectPageAt(pagination.page + 1); },
            prev: function() { selectPageAt(pagination.page - 1); }
          };

          scope.$on('$materialTabsChanged', function onSelectedTabChange() {
            if ( !pagination.active  ) return;
            if ( scope.$selIndex < 0 ) return;

            var selectedIndex = scope.$selIndex;

            if ( !isTabInRange(selectedIndex) ) {
              selectPageAt( getPageAtTabIndex( selectedIndex ) );
            }
          });

          return updatePagination;


          /**
           * Select the specified page in the page group and
           * also change the selected the tab if the current
           * tab selected is **not** within the new page range.
           *
           * @param page
           */
          function selectPageAt(page) {
            var lastPage = pagination.pagesCount - 1;
            var lastTab = buttonBar.children().length - 1;

            if ( page < 0 ) page = 0;
            if ( page > lastPage ) page = lastPage;

            pagination.startIndex = !pagination.active ? 0       : page * pagination.itemsPerPage;
            pagination.endIndex   = !pagination.active ? lastTab : pagination.startIndex + pagination.itemsPerPage - 1;
            pagination.hasPrev    = !pagination.active ? false   : page > 0;
            pagination.hasNext    = !pagination.active ? false   : (page + 1) < pagination.pagesCount;

            slideTabButtons( -page * pagination.itemsPerPage * pagination.tabWidth );

            if ( !isTabInRange(scope.$selIndex) ) {
                var index = (page > pagination.page) ?  pagination.startIndex : pagination.endIndex;

                // Only change selected tab IF the current tab is not `in range`
                tabsController.selectAt( index );
            }

            pagination.page = page;

          }

          /**
           * Determine the associated page for the specified tab index
           * @param tabIndex
           */
          function getPageAtTabIndex( tabIndex ) {

            var numPages = pagination.pagesCount;
            var lastTab = (pagination.itemsPerPage * pagination.pagesCount) - 1;
            var lastPage = pagination.pagesCount - 1;

            return (numPages < 1)       ? -1       :
                   (tabIndex < 0)       ?  0       :
                   (tabIndex > lastTab) ? lastPage : Math.floor(tabIndex / pagination.itemsPerPage);
          }

          /**
           * When the window resizes [`resize`] or the tabs are added/removed
           * [$materialTabsChanged], then calculate pagination-width and
           * update both the current page (if needed) and the tab headers width...
           */
          function updatePagination() {

            var tabs = buttonBar.children();
            var tabsWidth = element.prop('offsetWidth') - PAGINATORS_WIDTH;
            var needPagination = (TAB_MIN_WIDTH * tabs.length) > tabsWidth;
            var paginationToggled = (needPagination !== pagination.active);

            pagination.active = needPagination;

            if (needPagination) {

              pagination.pagesCount = Math.ceil((TAB_MIN_WIDTH * tabs.length) / tabsWidth);
              pagination.itemsPerPage = Math.max(1, Math.floor(tabs.length / pagination.pagesCount));
              pagination.tabWidth = tabsWidth / pagination.itemsPerPage;

              // If we just activated pagination, go to page 0 and watch the
              // selected tab index to be sure we're on the same page
              var pageIndex = paginationToggled ? getPageAtTabIndex(scope.$selIndex) :
                              Math.min( Math.max(pagination.page || 0, 0), pagination.pagesCount - 1);

              // Manually set width of page...
              buttonBar.css('width', pagination.tabWidth * tabs.length + 'px');

              selectPageAt( pageIndex );

            } else {

              if (paginationToggled) {
                // Release buttonBar to be self-adjust to size of all tab buttons
                // Slide tab buttons to show all buttons (starting at first)

                buttonBar.css('width', '');

                selectPageAt( 0 );
              }
            }
          }

          /**
           * Perform animated CSS translation of the tab buttons container
           * @param xOffset
           */
          function slideTabButtons( xOffset ) {
            if ( scope.pagingOffset == xOffset ) return;
            if ( isNaN(xOffset) ) xOffset = 0;

            scope.pagingOffset = xOffset;
            buttonBar.css( $materialEffects.TRANSFORM, 'translate3d(' + xOffset + 'px,0,0)');
          }

          /**
           * Is the specified tabIndex with the tab range allowed
           * for the current page/pagination?
           *
           * @param tabIndex
           * @returns {boolean}
           */
          function isTabInRange( tabIndex ){
            return (tabIndex >= pagination.startIndex) &&
                   (tabIndex <= pagination.endIndex);
          }

        }

        /**
         * Change the positioning of the tab header and buttons.
         * If the tabs-align attribute is 'bottom', then the tabs-content
         * container is transposed with the tabs-header
         */
        function alignTabButtons() {
          var align  = attrs.tabsAlign || "top";
          var container = findNode('.tabs-content', element);

          if (align == "bottom") {
            element.prepend(container);
          }
        }

        /**
         * If an initial tab selection has not been specified, then
         * select the first tab by default
         */
        function selectDefaultTab() {
          var tabs = tabsController.$$tabs();

          if ( tabs.length && angular.isUndefined(scope.$selIndex)) {
            tabsController.select(tabs[0]);
          }
        }


        /**
         * Transclude the materialTab items into the tabsHeaderItems container
         *
         */
        function transcludeHeaderItems() {
          $transclude( function (content) {
            var header = findNode('.tabs-header-items', element);
            var parent = angular.element(element[0]);

            angular.forEach(content, function (node) {
              var intoHeader = isNodeType(node, 'material-tab') || isNgRepeat(node);

              if (intoHeader) {
                header.append(node);
              } else {
                parent.prepend(node);
              }
            });
          });
        }


        /**
         * Transclude the materialTab view/body contents into materialView containers; which
         * are stored in the tabsContent area...
         */
        function transcludeContentItems() {
          var cntr = findNode('.tabs-content', element),
              materialViewTmpl = '<div class="material-view" ng-show="active"></div>';

          scope.$watch(getTabsHash, function buildContentItems() {
            var tabs = tabsController.$$tabs(notInCache),
              views = tabs.map(extractContent);

            // At least 1 tab must have valid content to build; otherwise
            // we hide/remove the tabs-content container...

            if (views.some(notEmpty)) {
              angular.forEach(views, function (content, j) {

                var tab = tabs[j++],
                  materialView = $compile(materialViewTmpl)(tab);

                // For ARIA, link the tab content container with the tab button...
                configureAria( materialView, tab );

                // Allow dynamic $digest() disconnect/reconnect of tab content's scope
                enableDisconnect(tab, content.scope);

                // Do we have content DOM nodes ?
                // If transcluded content is not undefined then add all nodes to the materialView

                if (content.nodes) {
                  angular.forEach(content.nodes, function (node) {
                    if ( !isNodeEmpty(node) ) {
                      materialView.append(node);
                    }
                  });
                }

                cntr.append(materialView);
                addToCache(cache, { tab:tab, element: materialView });

              });

              // We have some new content just added...
              showTabContent();

            } else {

              showTabContent(false);

            }


            /**
             * Add class to hide or show the container for the materialView(s)
             * NOTE: the `<div.tabs-content>` is **hidden** by default.
             * @param visible Boolean a value `true` will remove the `class="ng-hide"` setting
             */
            function showTabContent(visible) {
              cntr.toggleClass('ng-hide', !!visible);
            }

            /**
             * Configure ARIA attributes to link tab content back to their respective
             * 'owning' tab buttons.
             */
            function configureAria( cntr, tab ) {

              $aria.update( cntr, {
                'id' : "content_" + tab.ariaId,
                'role' : Constant.ARIA.ROLE.TAB_PANEL,
                'aria-labelledby' : tab.ariaId
              });

            }

          });

          /**
           * Allow tabs to disconnect or reconnect their content from the $digest() processes
           * when unselected or selected (respectively).
           *
           * @param content Special content scope which is a direct child of a `tab` scope
           */
          function enableDisconnect(tab,  content) {
            if ( !content ) return;

            var selectedFn = angular.bind(tab, tab.selected),
                deselectedFn = angular.bind(tab, tab.deselected);

            addDigestConnector(content);

            // 1) Tail-hook deselected()
            tab.deselected = function() {
              deselectedFn();
              tab.$$postDigest(function(){
                content.$disconnect();
              });
            };

             // 2) Head-hook selected()
            tab.selected = function() {
              content.$reconnect();
              selectedFn();
            };

            // Immediate disconnect all non-actives
            if ( !tab.active ) {
              tab.$$postDigest(function(){
                content.$disconnect();
              });
            }
          }

          /**
           * Add tab scope/DOM node to the cache and configure
           * to auto-remove when the scope is destroyed.
           * @param cache
           * @param item
           */
          function addToCache(cache, item) {
            var scope = item.tab;

            cache[ scope.$id ] = item;
            cache.length = cache.length + 1;

            // When the tab is removed, remove its associated material-view Node...
            scope.$on("$destroy", function () {
              angular.element(item.element).remove();

              delete cache[ scope.$id];
              cache.length = cache.length - 1;
            });
          }

          function getTabsHash() {
            return tabsController.$$hash;
          }

          /**
           * Special function to extract transient data regarding transcluded
           * tab content. Data includes dynamic lookup of bound scope for the transcluded content.
           *
           * @see TabDirective::updateTabContent()
           *
           * @param tab
           * @returns {{nodes: *, scope: *}}
           */
          function extractContent(tab) {
            var content = hasContent(tab) ? tab.content : undefined;
            var scope   = (content && content.length) ? angular.element(content[0]).scope() : null;

            // release immediately...
            delete tab.content;

            return { nodes:content, scope:scope };
          }

          function hasContent(tab) {
            return tab.content && tab.content.length;
          }

          function notEmpty(view) {
            var hasContent = false;
            if (angular.isDefined(view.nodes)) {
              angular.forEach(view.nodes, function(node) {
                hasContent = hasContent || !isNodeEmpty(node);
              });
            }
            return hasContent;
          }

          function notInCache(tab) {
            return !cache.contains(tab);
          }
        }

      }
    };

    function findNode(selector, element) {
      var container = element[0];
      return angular.element(container.querySelector(selector));
    }

  }

}

/**
 * @ngdoc directive
 * @name materialTab
 * @module material.components.tabs
 * @order 1
 *
 * @restrict E
 *
 * @description
 * `<material-tab>` is the nested directive used [within `<material-tabs>`] to specify each tab with a **label** and optional *view content*
 *
 * If the `label` attribute is not specified, then an optional `<material-tab-label>` tag can be used to specified more
 * complex tab header markup. If neither the **label** nor the **material-tab-label** are specified, then the nested
 * markup of the `<material-tab>` is used as the tab header markup.
 *
 * If a tab **label** has been identified, then any **non-**`<material-tab-label>` markup
 * will be considered tab content and will be transcluded to the internal `<div class="tabs-content">` container.
 *
 * This container is used by the TabsController to show/hide the active tab's content view. This synchronization is
 * automatically managed by the internal TabsController whenever the tab selection changes. Selection changes can
 * be initiated via data binding changes, programmatic invocation, or user gestures.
 *
 * @param {string=} label Optional attribute to specify a simple string as the tab label
 * @param {boolean=} active Flag indicates if the tab is currently selected; normally the `<material-tabs selected="">`; attribute is used instead.
 * @param {boolean=} ngDisabled Flag indicates if the tab is disabled: not selectable with no ink effects
 * @param {expression=} deselected Expression to be evaluated after the tab has been de-selected.
 * @param {expression=} selected Expression to be evaluated after the tab has been selected.
 *
 *
 * @usage
 *
 * <hljs lang="html">
 * <material-tab label="" disabled="" selected="" deselected="" >
 *   <h3>My Tab content</h3>
 * </material-tab>
 *
 * <material-tab >
 *   <material-tab-label>
 *     <h3>My Tab content</h3>
 *   </material-tab-label>
 *   <p>
 *     Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium,
 *     totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae
 *     dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit,
 *     sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
 *   </p>
 * </material-tab>
 * </hljs>
 *
 */
function TabDirective( $attrBind, $aria ) {
  var noop = angular.noop;

  return {
    restrict: 'E',
    replace: false,
    require: "^materialTabs",
    transclude: 'true',
    scope: true,
    link: linkTab,
    template:
      '<material-tab-label ink-ripple ' +
        'ng-class="{ disabled : disabled, active : active }"  >' +
      '</material-tab-label>'
  };

  function linkTab(scope, element, attrs, tabsController, $transclude) {
    var defaults = { active: false, disabled: false, deselected: noop, selected: noop };

    // Since using scope=true for inherited new scope,
    // then manually scan element attributes for forced local mappings...

    $attrBind(scope, attrs, {
      label: '@?',
      active: '=?',
      disabled: '=?ngDisabled',
      deselected: '&onDeselect',
      selected: '&onSelect'
    }, defaults);

    configureWatchers();
    updateTabContent(scope);

    // Update ARIA values for each tab element
    configureAria(element, scope);

    element.on('click', function onRequestSelect()
      {
        // Click support for entire <material-tab /> element
        if ( !scope.disabled ) {
          scope.$apply(function () {
            tabsController.select(scope);
          });
        }
      })
      .on('keydown', function onRequestSelect(event)
      {
        if(event.which === Constant.KEY_CODE.LEFT_ARROW) {
          tabsController.previous(scope);
        }
        if(event.which === Constant.KEY_CODE.RIGHT_ARROW) {
          tabsController.next(scope);
        }
      });

    tabsController.add(scope, element);

    // **********************************************************
    // Private Methods
    // **********************************************************


    /**
     * Inject ARIA-specific attributes appropriate for each Tab button
     */
    function configureAria( element, scope ){
      var ROLE = Constant.ARIA.ROLE;

      scope.ariaId = buildAriaID();
      $aria.update( element, {
        'id' :  scope.ariaId,
        'role' : ROLE.TAB,
        'aria-selected' : false,
        'aria-controls' : "content_" + scope.ariaId
      });

      /**
       * Build a unique ID for each Tab that will be used for WAI-ARIA.
       * Preserve existing ID if already specified.
       * @returns {*|string}
       */
      function buildAriaID() {
        return attrs.id || ( ROLE.TAB + "_" + tabsController.$scope.$id + "_" + scope.$id );
      }
    }

    /**
     * Auto select the next tab if the current tab is active and
     * has been disabled.
     *
     * Set tab index for the current tab (0), with all other tabs
     * outside of the tab order (-1)
     *
     */
    function configureWatchers() {
      var unwatch = scope.$watch('disabled', function (isDisabled) {
        if (scope.active && isDisabled) {
          tabsController.next(scope);
        }
      });

      scope.$watch('active', function (isActive) {

        $aria.update( element, {
          'aria-selected' : isActive,
          'tabIndex' : isActive === true ? 0 : -1
        });

      });

      scope.$on("$destroy", function () {
        unwatch();
        tabsController.remove(scope);
      });
    }

    /**
     * Transpose the optional `label` attribute value or materialTabHeader or `content` body
     * into the body of the materialTabButton... all other content is saved in scope.content
     * and used by TabsController to inject into the `tabs-content` container.
     */
    function updateTabContent(scope) {
      var tab = scope;

      // Check to override label attribute with the content of the <material-tab-header> node,
      // If a materialTabHeader is not specified, then the node will be considered
      // a <material-view> content element...
      $transclude(function ( contents ) {

        // Transient references...
        tab.content = [ ];

        angular.forEach(contents, function (node) {

          if (!isNodeEmpty(node)) {
            if (isNodeType(node, 'material-tab-label')) {
              // Simulate use of `label` attribute

              tab.label = node.childNodes;

            } else {
              // Transient references...
              //
              // Attach to scope for future transclusion into materialView(s)
              // We need the bound scope for the content elements; which is NOT
              // the scope of tab or material-view container...

              tab.content.push(node);
            }
          }
        });

      });

      // Prepare to assign the materialTabButton content
      // Use the label attribute or fallback to TabHeader content

      var cntr = angular.element(element[0].querySelector('material-tab-label'));

      if (angular.isDefined(scope.label)) {
        // The `label` attribute is the default source

        cntr.append(scope.label);

        delete scope.label;

      } else {

        // NOTE: If not specified, all markup and content is assumed
        // to be used for the tab label.

        angular.forEach(scope.content, function (node) {
          cntr.append(node);
        });

        delete scope.content;
      }
    }

  }
}

/**
 * @ngdoc object
 * @name materialTabsController
 * @module material.components.tabs
 * @description Controller used within `<material-tabs>` to manage tab selection and iteration
 *
 * @private
 */
function TabsController($scope, $attrs, $materialComponentRegistry, $timeout, $$rAF ) {
  var list = Util.iterator([], false),
    componentID = "tabs" + $scope.$id,
    elements = { },
    selected = null,
    self = this;

  $materialComponentRegistry.register( self, $attrs.componentId || componentID );

  // Methods used by <material-tab> and children

  this.add = addTab;
  this.remove = removeTab;
  this.select = selectTab;
  this.selectAt = selectTabAt;
  this.next = selectNext;
  this.previous = selectPrevious;

  // Property for child access
  this.noink = !!$scope.noink;
  this.nobar = !!$scope.nobar;
  this.scope = $scope;

  // Special internal accessor to access scopes and tab `content`
  // Used by TabsDirective::buildContentItems()

  this.$scope = $scope;
  this.$$tabs = findTabs;
  this.$$hash = "";

  this.selectedElement = function() {
    return findElementFor( selected );
  };

  function onTabsChanged() {
    if (onTabsChanged.queued) return;
    onTabsChanged.queued = true;

    $scope.$evalAsync(function() {
      $scope.$broadcast('$materialTabsChanged');

      $$rAF( function autoFocus() {
        var selected = self.selectedElement();
        if ( selected ) selected.focus();
      });

      onTabsChanged.queued = false;
    });
  }

  /**
   * Find the DOM element associated with the tab/scope
   * @param tab
   * @returns {*}
   */
  function findElementFor(tab) {
    if ( angular.isUndefined(tab) ) {
      tab = selected;
    }
    return tab ? elements[ tab.$id ] : undefined;
  }

  /**
   * Publish array of tab scope items
   * NOTE: Tabs are not required to have `contents` and the
   *       node may be undefined.
   * @returns {*} Array
   */
  function findTabs(filterBy) {
    return list.items().filter(filterBy || angular.identity);
  }

  /**
   * Create unique hashKey representing all available
   * tabs.
   */
  function updateHash() {
    self.$$hash = list.items()
      .map(function (it) {
        return it.$id;
      })
      .join(',');
  }

  /**
   * Select specified tab; deselect all others (if any selected)
   * @param tab
   */
  function selectTab(tab, noUpdate) {
    if ( tab == selected ) return;

    var activate = makeActivator(true),
      deactivate = makeActivator(false);

    // Turn off all tabs (if current active)
    angular.forEach(list.items(), deactivate);

    if ( tab != null ) {
      // Activate the specified tab (or next available)
      selected = activate(tab.disabled ? list.next(tab, isEnabled) : tab);

      // update external models and trigger databinding watchers
      $scope.$selIndex = selected ? String(selected.$index || list.indexOf(selected)) : -1;

      // update the tabs ink to indicate the selected tab
      if (!noUpdate) {
        onTabsChanged();
      }
    }

    return selected;
  }

  /**
   * Select tab based on its index position
   * @param index
   */
  function selectTabAt(index, noUpdate) {

    if (list.inRange(index)) {
      var matches = list.findBy("$index", index),
          it = matches ? matches[0] : null;

      if (it != selected) {

        // Tab must be selectable...
        if ( !isEnabled(it) ) {
          it = selectNext(it);
        }

        selectTab( it || list.first(), noUpdate );
      }
    }
  }

  /**
   * Add tab to list and auto-select; default adds item to end of list
   * @param tab
   */
  function addTab(tab, element) {

    if (angular.isUndefined(tab.$index)) {
      tab.$index = list.count();
    }

    // cache materialTab DOM element; these are not materialView elements
    elements[ tab.$id ] = element;

    if (!list.contains(tab)) {
      var pos = list.add(tab, tab.$index);

      // Should we auto-select it?
      if ($scope.$selIndex == pos || tab.active) {
        selectTab(tab);
      } else {
        onTabsChanged();
      }
    }


    updateHash();

    return tab.$index;
  }

  /**
   * Remove the specified tab from the list
   * Auto select the next tab or the previous tab (if last)
   * @param tab
   */
  function removeTab(tab) {
    if (list.contains(tab)) {

      selectTab( list.next(tab, isEnabled) || list.previous(tab, isEnabled) );
      list.remove(tab);

      onTabsChanged();
      // another tab was removed, make sure to update ink bar
      $timeout(function(){
        delete elements[tab.$id];
      },300);

    }

    updateHash();
  }

  /**
   * Select the next tab in the list
   * @returns {*} Tab
   */
  function selectNext(target) {
    var next = list.next( target, isEnabled );

    return next ? selectTab( next ) :
           target.disabled ? selectPrevious(target) : target;
  }

  /**
   * Select the previous tab
   * @returns {*} Tab
   */
  function selectPrevious(target) {
    var previous = list.previous(target, isEnabled );

    return previous ? selectTab( previous ) :
           target.disabled ? selectNext(target) : target;


  }

  /**
   * Validation criteria for list iterator when List::next() or List::previous() is used..:
   * In this case, the list iterator should skip items that are disabled.
   * @param tab
   * @returns {boolean}
   */
  function isEnabled(tab) {
    return tab && !tab.disabled;
  }

  /**
   * Partial application to build function that will
   * mark the specified tab as active or not. This also
   * allows the `updateStatus` function to be used as an iterator.
   *
   * @param active
   */
  function makeActivator(active) {

    return function updateState(tab) {
      if (tab && (active != tab.active)) {
        tab.active = active;

        if (active) {
          selected = tab;

          tab.selected();

        } else {
          if (selected == tab) {
            selected = null;
          }

          tab.deselected();

        }
        return tab;
      }
      return null;
    };
  }

}

/**
 * Determine if the DOM element is of a certain tag type
 * or has the specified attribute type
 *
 * @param node
 * @returns {*|boolean}
 */
var isNodeType = function (node, type) {
  return node.tagName && (
    node.hasAttribute(type) ||
    node.hasAttribute('data-' + type) ||
    node.tagName.toLowerCase() === type ||
    node.tagName.toLowerCase() === 'data-' + type
  );
};

var isNgRepeat = function (node) {
  var COMMENT_NODE = 8;
  return node.nodeType == COMMENT_NODE && node.nodeValue.indexOf('ngRepeat') > -1;
};

/**
 * Is the an empty text string
 * @param node
 * @returns {boolean}
 */
var isNodeEmpty = function (node) {
  var TEXT_NODE = 3,
      COMMENT_NODE = 8;
  return (node.nodeType == COMMENT_NODE) ||
    (node.nodeType == TEXT_NODE && !(node.nodeValue || '').trim());
};

