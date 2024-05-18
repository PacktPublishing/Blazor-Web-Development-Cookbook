using Microsoft.AspNetCore.Components.Forms;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe06;

public class TypeValidationClassProvider : FieldCssClassProvider
{
    private static readonly string
        _capacity = nameof(EventLocation.Capacity);

    public override string GetFieldCssClass(EditContext editContext,
        in FieldIdentifier fieldIdentifier)
    {
        var isValid = editContext.IsValid(fieldIdentifier);
        var isCapacity = fieldIdentifier.FieldName == _capacity;

        if (!isValid && isCapacity)
            return "invalid-warning";

        return base.GetFieldCssClass(editContext, fieldIdentifier);            
    }
}
