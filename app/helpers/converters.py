from flask import json

def string_to_nested_dict(json_string):
    """
    Converts a JSON string to a Python dictionary and recursively
    processes nested dictionaries.

    Args:
        json_string (str): The JSON string to convert.

    Returns:
        dict or None: The Python dictionary representation of the string,
                     or None if the string cannot be parsed as JSON.
    """
    try:
        data = json.loads(json_string)
        return process_nested_dict(data)
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON string: {json_string}")
        return None

def process_nested_dict(data):
    """
    Recursively loops through a dictionary and its nested dictionaries.

    Args:
        data (dict): The dictionary to process.

    Returns:
        dict: The (potentially modified) dictionary after processing.
              In this example, it returns the original dictionary.
              You can modify this function to perform actions on the data.
    """
    for key, value in data.items():
        # You can perform actions on each key-value pair here
        print(f"Processing key: {key}, value: {value} (Type: {type(value)})")

        if isinstance(value, dict):
            print(f"Found nested dictionary for key: {key}")
            process_nested_dict(value)  # Recursive call for nested dictionary
        elif isinstance(value, list):
            print(f"Found list for key: {key}")
            process_nested_list(value)

    return data  # Return the (potentially modified) dictionary

def process_nested_list(data_list):
    """
    Recursively loops through a list and processes its elements,
    handling nested dictionaries and lists.

    Args:
        data_list (list): The list to process.
    """
    for item in data_list:
        print(f"Processing list item: {item} (Type: {type(item)})")
        if isinstance(item, dict):
            print("Found nested dictionary in list:")
            process_nested_dict(item)
        elif isinstance(item, list):
            print("Found nested list in list:")
            process_nested_list(item)

