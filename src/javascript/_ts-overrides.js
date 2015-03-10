
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
