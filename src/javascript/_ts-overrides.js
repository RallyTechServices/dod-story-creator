//Ext.override(Rally.ui.menu.RecordMenu,{
//    items: [{
//        predicate: function(record){ return true;}
//    }]
//});
//
//
//     Ext.override(Rally.ui.grid.RowActionColumn, {
////        requires: [
////            'Rally.ui.menu.RecordMenu',
////            'Rally.util.Test'
////        ],
////        extend: 'Ext.grid.column.Column',
////        alias: 'widget.rallyrowactioncolumn',
////
//        inheritableStatics: {
//            getRequiredFetchFields: function(grid) {
//                return (grid.enableBulkEdit && ['Project', 'Tags']) || [];
//            }
//        },
//
//        clientMetrics: {
//            event: 'click',
//            description: 'clicked gear menu'
//        },
//
//        /**
//         * @property {Boolean} sortable False to disable sorting of this column
//         *
//         */
//        sortable: false,
//        /**
//         * @property {Boolean} hideable False to disable hiding of column
//         *
//         */
//        hideable: false,
//        /**
//         * @property {Boolean} resizable False to disable resizing of column
//         *
//         */
//        resizable: false,
//        /**
//         * @property {Boolean} draggable False to disable reordering of a column
//         *
//         */
//        draggable: false,
//        /**
//         * @property {Boolean} menuDisabled True to disable the column header menu containing sort/hide options
//         *
//         */
//        menuDisabled: true,
//        /**
//         * @property {Number}
//         *
//         */
//        flex: -1,
//        minWidth: Ext.isIE9 ? 22 : 26,
//        maxWidth: Ext.isIE9 ? 22 : 26,
//
//        /**
//         * @property {Boolean}
//         * This column should not show up on print pages that include a printable grid
//         */
//        printable: false,
//
//        tdCls: 'rally-cell-row-action',
//        rowActionsFn: function(record){
//            return [{
//                text: 'Set all Required', 
//                record: record, 
//                handler: function(){alert('hi');}
//            }];
//        } ,
//        config: {
//            /**
//             * @cfg {Function} rowActionsFn
//             * @params record {Ext.data.Record} The record to be assigned to record menu items
//             * A list of Rally.ui.menu.Menu#items objects that will be used as the row action options
//             * Each row action can contain a predicate property which will be evaluated to see if the row action should be included
//             * Usage:
//             *      [
//             *          {text: 'Move...', record: record, handler: function(){  // move this.record  }}
//             *      ]
//             */
//            rowActionsFn: function(record){
//                return [{
//                    text: 'Set all Required', 
//                    record: record, 
//                    handler: function(){alert('hi');}
//                }];
//            } 
//        },
//
//        constructor: function() {
//            this.callParent(arguments);
//            this.renderer = this._renderGearIcon;
//        },
//
//        initComponent: function() {
//            this.callParent(arguments);
//            this.on('click', this._showMenu, this);
//        },
//
//        onDestroy: function() {
//            if (this.menu) {
//                this.menu.destroy();
//                delete this.menu;
//            }
//
//            this.callParent(arguments);
//        },
//
//        /**
//         * @private
//         * @param value
//         * @param metaData
//         * @param record
//         */
//        _renderGearIcon: function(value, metaData, record) {
//            metaData.tdCls = Rally.util.Test.toBrowserTestCssClass('row-action', Rally.util.Ref.getOidFromRef(record.get('_ref')));
//
//            if (record.get("updatable") || record.get("deletable") || record.get("creatable")) {
//                return '<div class="row-action-icon icon-gear"/>';
//            }
//
//            return '';
//        },
//
//        /**
//         * @private
//         * @param view
//         * @param el
//         */
//        _showMenu: function(view, el) {
//            var selectedRecord = view.getRecord(Ext.fly(el).parent("tr")),
//                checkedRecords = view.getSelectionModel().getSelection(),
//                grid = view.panel,
//                defaultOptions;
//
//            defaultOptions = {
//                cls: Rally.util.Test.toBrowserTestCssClass('row-gear-menu-' + selectedRecord.getId()) + ' row-gear-menu',
//                record: selectedRecord,
//                owningEl: el.parentElement,
//                popoverPlacement: ['bottom', 'top'],
//                rankRecordHelper: {
//                    findRecordToRankAgainst: function(options) {
//                        grid.findRankedRecord(options);
//                    },
//                    getMoveToPositionStore: function(options) {
//                        return grid.getMoveToPositionStore(options);
//                    }
//                },
//                onBeforeRecordMenuCopy: function(record) {
//                    return grid.onBeforeRecordMenuCopy(record);
//                },
//                onRecordMenuCopy: function(copiedRecord, originalRecord, operation) {
//                    return grid.onRecordMenuCopy(copiedRecord, originalRecord, operation);
//                },
//                onBeforeRecordMenuEdit: function(record) {
//                    return grid.onBeforeRecordMenuEdit(record);
//                },
//                onBeforeRecordMenuDelete: function(record) {
//                    return grid.onBeforeRecordMenuDelete(record);
//                },
//                onRecordMenuDelete: function(record) {
//                    return grid.onRecordMenuDelete(record);
//                },
//                onBeforeRecordMenuRankHighest: function(record) {
//                    return grid.onBeforeRecordMenuRankHighest(record);
//                },
//                onBeforeRecordMenuRankLowest: function(record) {
//                    return grid.onBeforeRecordMenuRankLowest(record);
//                },
//                shouldRecordBeRankable: function(record) {
//                    return grid.shouldRecordBeRankable(record);
//                }
//            };
//            console.log('rowActionsFn',this.rowActionsFn);
//            if (grid.enableBulkEdit && _.contains(checkedRecords, selectedRecord)) {
//                this.menu = Ext.create('Rally.ui.menu.bulk.RecordMenu', {
//                    context: grid.getContext(),
//                    records: checkedRecords,
//                    onBeforeAction: function() {
//                        if (view.loadMask && _.isFunction(view.loadMask.disable)) {
//                            view.loadMask.disable();
//                        }
//                        grid.setLoading('Updating...');
//                    },
//                    onActionComplete: function(successfulRecords, unsuccessfulRecords, changes) {
//                        grid.refreshAfterBulkAction(successfulRecords, changes).then({
//                            success: function() {
//                                grid.setLoading(false);
//                                if (view.loadMask && _.isFunction(view.loadMask.enable)) {
//                                    view.loadMask.enable();
//                                }
//                                grid.getSelectionModel().deselect(successfulRecords);
//                                grid.getSelectionModel().select(unsuccessfulRecords);
//                                _.each(successfulRecords, grid.highlightRowForRecord, grid);
//                                grid.publish(Rally.Message.bulkUpdate, successfulRecords, changes, grid);
//                            }
//                        });
//                    }
//                });
//            } else if (this.rowActionsFn) {
//                this.menu = Ext.create('Rally.ui.menu.RecordMenu', Ext.apply({
//                    items: this.rowActionsFn.call(this.scope || this, selectedRecord)
//                }, defaultOptions));
//            } else {
//                this.menu = Ext.create('Rally.ui.menu.DefaultRecordMenu', defaultOptions);
//            }
//
//            this.menu.showBy(Ext.fly(el).down(".row-action-icon"));
//        }
//    });
Ext.override(Ext.layout.container.Editor, {
    calculate: function(ownerContext) {
        console.log(ownerContext);
        var me = this,
            owner = me.owner,
            autoSize = owner.autoSize,
            fieldWidth,
            fieldHeight;
            
        if (autoSize === true) {
            autoSize = me.autoSizeDefault;
        }

        
        if (autoSize) {
            fieldWidth  = me.getDimension(owner, autoSize.width,  'getWidth',  owner.width);
            fieldHeight = me.getDimension(owner, autoSize.height, 'getHeight', owner.height);
        }

        if (ownerContext.childItems[0]){
            ownerContext.childItems[0].setSize(fieldWidth, fieldHeight);
        }

        
        ownerContext.setWidth(fieldWidth);
        ownerContext.setHeight(fieldHeight);

        
        ownerContext.setContentSize(fieldWidth || owner.field.getWidth(),
                                    fieldHeight || owner.field.getHeight());
    }
});
