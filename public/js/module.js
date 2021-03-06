
(function(Icinga) {

    var Bp = function(module) {
        /**
         * YES, we need Icinga
         */
        this.module = module;

        this.idCache = {};

        this.initialize();

        this.module.icinga.logger.debug('BP module loaded');
    };

    Bp.prototype = {

        initialize: function()
        {
            /**
             * Tell Icinga about our event handlers
             */
            this.module.on('beforerender', this.rememberOpenedBps);
            this.module.on('rendered',     this.onRendered);

            this.module.on('click', 'table.bp.process > tbody > tr:first-child > td > a:last-child', this.processTitleClick);
            this.module.on('click', 'table.bp > tbody > tr:first-child > th', this.processOperatorClick);
            this.module.on('focus', 'form input, form textarea, form select', this.formElementFocus);

            this.module.on('mouseenter', 'table.bp > tbody > tr > td > a', this.procMouseOver);
            this.module.on('mouseenter', 'table.bp > tbody > tr > th', this.procMouseOver);
            this.module.on('mouseenter', 'table.node.missing > tbody > tr > td > span', this.procMouseOver);
            this.module.on('mouseleave', 'div.bp', this.procMouseOut);

            this.module.on('click', 'div.tiles > div', this.tileClick);

            this.module.icinga.logger.debug('BP module initialized');
        },

        onRendered: function (event) {
            var $container = $(event.currentTarget);
            this.fixFullscreen($container);
            this.fixOpenedBps($container);
            this.highlightFormErrors($container);
            this.hideInactiveFormDescriptions($container);
            this.fixTileLinksOnDashboard($container);
        },

        processTitleClick: function (event) {
            event.stopPropagation();
            var $el = $(event.currentTarget).closest('table.bp');
            $el.toggleClass('collapsed');
        },

        processOperatorClick: function (event) {
            event.stopPropagation();
            var $el = $(event.currentTarget).closest('table.bp');

            // Click on arrow
            $el.removeClass('collapsed');

            var children = $el.find('> tbody > tr > td > table.bp.process');
            if (children.length === 0) {
                $el.toggleClass('collapsed');
                return;
            }
            if (children.filter('.collapsed').length) {
                children.removeClass('collapsed');
            } else {
                children.each(function(idx, el) {
                    var $el = $(el);
                    $el.addClass('collapsed');
                    $el.find('table.bp.process').addClass('collapsed');
                });
            }
        },

        hideInactiveFormDescriptions: function($container) {
            $container.find('dd').not('.active').find('p.description').hide();
        },

        tileClick: function(event) {
            $(event.currentTarget).find('> a').first().trigger('click');
        },

        /**
         * Add 'hovered' class to hovered title elements
         *
         * TODO: Skip on tablets
         */
        procMouseOver: function (event) {
            event.stopPropagation();
            var $hovered = $(event.currentTarget);
            var $el = $hovered.closest('table.bp');

            if ($el.is('.operator')) {
                if (!$hovered.closest('tr').is('tr:first-child')) {
                    // Skip hovered space between cols
                    return;
                }
            } else {
               // return;
            }

            $('table.bp.hovered').not($el.parents('table.bp')).removeClass('hovered'); // not self & parents
            $el.addClass('hovered');
            $el.parents('table.bp').addClass('hovered');
        },

        /**
         * Remove 'hovered' class from hovered title elements
         *
         * TODO: Skip on tablets
         */
        procMouseOut: function (event) {
            $('table.bp.hovered').removeClass('hovered');
        },

        /**
         * Handle clicks on operator or title element
         *
         * Title shows subelement, operator unfolds all subelements
         */
        titleClicked: function (event) {
            var self = this;
            event.stopPropagation();
            event.preventDefault();
            var $el = $(event.currentTarget),
                affected = []
                $container = $el.closest('.container');
            if ($el.hasClass('operator')) {
                $affected = $el.closest('table').children('tbody')
                    .children('tr.children').children('td').children('table');

                // Only if there are child BPs
                if ($affected.find('th.operator').length < 1) {
                    $affected = $el.closest('table');
                }
            } else {
                $affected = $el.closest('table');
            }
            $affected.each(function (key, el) {
                var $bptable = $(el).closest('table');
                $bptable.toggleClass('collapsed');
                if ($bptable.hasClass('collapsed')) {
                    $bptable.find('table').addClass('collapsed');
                }
            });

            /*$container.data('refreshParams', {
                opened: self.listOpenedBps($container)
            });*/
        },

        fixTileLinksOnDashboard: function($container) {
            if ($container.closest('div.dashboard').length) {
                $container.find('div.tiles').data('baseTarget', '_next');
            }
        },

        fixFullscreen: function($container) {
            var $controls = $container.find('div.controls');
            var $layout = $('#layout');
            var icinga = this.module.icinga;
            if ($controls.hasClass('want-fullscreen')) {
                if (!$layout.hasClass('fullscreen-layout')) {

                    $layout.addClass('fullscreen-layout');
                    $controls.removeAttr('style');
                    $container.find('.fake-controls').remove();
                    icinga.ui.currentLayout = 'fullscreen';
                }
            } else {
                if ($layout.hasClass('fullscreen-layout')) {
                    $layout.removeClass('fullscreen-layout');
                    icinga.ui.layoutHasBeenChanged();
                    icinga.ui.initializeControls($container);
                }
            }
        },

        fixOpenedBps: function($container) {
            var $bpDiv = $container.find('div.bp');
            var bpName = $bpDiv.attr('id');

            if  (typeof this.idCache[bpName] === 'undefined') {
                return;
            }
            var $procs = $bpDiv.find('table.process');

            $.each(this.idCache[bpName], function(idx, id) {
                var $el = $('#' + id);
                $procs = $procs.not($el);

                $el.parents('table.process').each(function (idx, el) {
                    $procs = $procs.not($(el));
                });
            });

            $procs.addClass('collapsed');
        },

        /**
         * Get a list of all currently opened BPs.
         *
         * Only get the deepest nodes to keep requests as small as possible
         */
        rememberOpenedBps: function (event) {
            var ids = [];
            var $bpDiv = $(event.currentTarget).find('div.bp');
            var $bpName = $bpDiv.attr('id');

            $bpDiv.find('table.process')
                .not('table.process.collapsed')
                .not('table.process.collapsed table.process')
                .each(function (key, el) {
                ids.push($(el).attr('id'));
            });
            if (ids.length === 0) {
                return;
            }

            this.idCache[$bpName] = ids;
        },

        /** BEGIN Form handling, borrowed from Director **/
        formElementFocus: function(ev)
        {
            var $input = $(ev.currentTarget);
            var $dd = $input.closest('dd');
            $dd.find('p.description').show();
            if ($dd.attr('id') && $dd.attr('id').match(/button/)) {
                return;
            }
            var $li = $input.closest('li');
            var $dt = $dd.prev();
            var $form = $dd.closest('form');

            $form.find('dt, dd, li').removeClass('active');
            $li.addClass('active');
            $dt.addClass('active');
            $dd.addClass('active');
            $dd.find('p.description.fading-out')
                .stop(true)
                .removeClass('fading-out')
                .fadeIn('fast');

            $form.find('dd').not($dd)
                .find('p.description')
                .not('.fading-out')
                .addClass('fading-out')
                .delay(2000)
                .fadeOut('slow', function() {
                    $(this).removeClass('fading-out').hide()
                });
        },

        highlightFormErrors: function($container)
        {
            $container.find('dd ul.errors').each(function(idx, ul) {
                var $ul = $(ul);
                var $dd = $ul.closest('dd');
                var $dt = $dd.prev();

                $dt.addClass('errors');
                $dd.addClass('errors');
            });
        }
        /** END Form handling **/
    };

    Icinga.availableModules.businessprocess = Bp;

}(Icinga));

